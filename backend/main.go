package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"text/template"
	"time"

	"system-manager/database"

	"github.com/creack/pty"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
	"github.com/tredoe/osutil/user/crypt/sha512_crypt"
)

// --- Configuration ---
var jwtSecret = []byte("SUPER_SECRET_SYSTEM_KEY_CHANGE_THIS") // In production, use env var

var (
	CloudflareAPIToken string
	CloudflareZoneID   string
)

// --- Structs ---

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type SystemInfo struct {
	CPU CPUInfo `json:"cpu"`
	RAM RAMInfo `json:"ram"`
	Disk DiskInfo `json:"disk"`
}

type CPUInfo struct {
	ModelName string    `json:"model_name"`
	Cores     int       `json:"cores"`
	Threads   int       `json:"threads"`
	Usage     float64   `json:"usage"`
	UsagePerCore []float64 `json:"usage_per_core"`
}

type RAMInfo struct {
	Total       uint64  `json:"total"`
	Used        uint64  `json:"used"`
	UsedPercent float64 `json:"used_percent"`
}

type DiskInfo struct {
	Total       uint64  `json:"total"`
	Used        uint64  `json:"used"`
	UsedPercent float64 `json:"used_percent"`
}

type NetworkInfo struct {
	Interfaces []InterfaceInfo `json:"interfaces"`
	Stats      NetStats        `json:"stats"`
	PublicIP   string          `json:"public_ip"`
}

type InterfaceInfo struct {
	Name string   `json:"name"`
	IPv4 []string `json:"ipv4"`
	IPv6 []string `json:"ipv6"`
}

type NetStats struct {
	BytesSent uint64 `json:"bytes_sent"`
	BytesRecv uint64 `json:"bytes_recv"`
}

type ProcessInfo struct {
	PID      int32  `json:"pid"`
	Name     string `json:"name"`
	Port     int    `json:"port"`
	Protocol string `json:"protocol"`
}

type NginxFile struct {
	Name    string `json:"name"`
	Content string `json:"content,omitempty"`
}

type FirewallRule struct {
	ID     string `json:"id"` // Using index as ID for UFW
	To     string `json:"to"`
	Action string `json:"action"`
	From   string `json:"from"`
	Status string `json:"status"` // Active/Inactive (global)
}

type CreateSiteRequest struct {
	Domain string `json:"domain"`
	Type   string `json:"type"`   // "proxy" or "static"
	Target string `json:"target"` // port or path
	SSL    bool   `json:"ssl"`
}

type CloudflareRecordRequest struct {
	Type    string `json:"type"`
	Name    string `json:"name"`
	Content string `json:"content"`
	Proxied bool   `json:"proxied"`
	TTL     int    `json:"ttl"` // Optional, default 1 (auto)
}

// --- Middleware ---

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Bypass for login and public info if needed
		if c.FullPath() == "/api/login" {
			c.Next()
			return
		}

		// TEMPORARY BYPASS FOR WIZARD & DNS DEMO IF NO TOKEN
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next() // Allow without token for now
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			return jwtSecret, nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}

		c.Next()
	}
}

// --- Main ---

func main() {
	// Direct assignment to ensure no env var issues
	CloudflareAPIToken = "zNSOfC0VLF5du2m3MSyUAWlaIBoAnvzwBVaIkIPP"
	CloudflareZoneID = "24c7fd4d380e2a496e3f0515c844f16f"

	fmt.Println("System Manager Starting...")
	fmt.Printf("Configured Cloudflare Zone: %s\n", CloudflareZoneID)
	if len(CloudflareAPIToken) > 10 {
		fmt.Printf("Configured Cloudflare Token: %s...%s\n", CloudflareAPIToken[:4], CloudflareAPIToken[len(CloudflareAPIToken)-4:])
	} else {
		fmt.Println("Configured Cloudflare Token: (Invalid/Empty)")
	}

	r := gin.Default()

	// CORS
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	api := r.Group("/api")
	
	// Public Route
	api.POST("/login", loginHandler)

	// Protected Routes
	protected := api.Group("/")
	protected.Use(authMiddleware())
	{
		protected.GET("/system", getSystemInfo)
		protected.GET("/network", getNetworkInfo)
		protected.GET("/processes", getProcesses)
		protected.POST("/processes/kill", killProcess)
		protected.GET("/nginx/files", listNginxFiles)
		protected.GET("/nginx/file", getNginxFile)
		protected.POST("/nginx/file", saveNginxFile)
		protected.POST("/nginx/create-site", createSite)
		
		// Cloudflare
		protected.POST("/cloudflare/add-record", addDNSRecord)
		protected.GET("/cloudflare/records", listDNSRecords)
		protected.PUT("/cloudflare/record/:id", updateDNSRecord)
		protected.DELETE("/cloudflare/record/:id", deleteDNSRecord)

		// Firewall
		protected.GET("/firewall", getFirewallStatus)
		protected.POST("/firewall/add", addFirewallRule)
		protected.POST("/firewall/delete", deleteFirewallRule)

		// Databases
		protected.GET("/databases/status", handleDatabaseStatus)
		protected.POST("/databases/query", handleDatabaseQuery)
		protected.POST("/databases/schema", handleDatabaseSchema) // New route

		// Terminal (WebSocket)
		protected.GET("/terminal", terminalHandler)
	}

	r.Run(":8010")
}

// --- Auth Handler ---

func loginHandler(c *gin.Context) {
	var req LoginRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	if req.Username != "root" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Only root login allowed"})
		return
	}

	if verifyRootPassword(req.Password) {
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"username": req.Username,
			"exp":      time.Now().Add(time.Hour * 24).Unix(),
		})
		
		tokenString, err := token.SignedString(jwtSecret)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not generate token"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"token": tokenString})
	} else {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
	}
}

func verifyRootPassword(password string) bool {
	f, err := os.Open("/etc/shadow")
	if err != nil {
		return false
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	var hash string
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.Split(line, ":")
		if len(parts) > 1 && parts[0] == "root" {
			hash = parts[1]
			break
		}
	}

	if hash == "" || hash == "*" || hash == "!" {
		return false
	}

	c := sha512_crypt.New()
	parts := strings.Split(hash, "$")
	if len(parts) < 4 {
		return false
	}
	
	salt := "$" + parts[1] + "$" + parts[2]
	
	newHash, err := c.Generate([]byte(password), []byte(salt))
	if err != nil {
		return false
	}

	return newHash == hash
}

// --- Database Handlers ---

func handleDatabaseStatus(c *gin.Context) {
	serviceNames := map[string][]string{
		"postgresql":   {"postgresql", "postgresql.service", "postgres"},
		"redis-server": {"redis-server", "redis", "redis.service"},
		"mysql":        {"mysql", "mysqld", "mariadb"}, // MySQL and MariaDB are often interchangeable
	}
	statusMap := make(map[string]string)

	for dbType, names := range serviceNames {
		isActive := "inactive"
		for _, name := range names {
			cmd := exec.Command("systemctl", "is-active", name)
			if cmd.Run() == nil { // Command exits with 0 if active
				isActive = "active"
				break // Found an active service name for this DB type
			}
		}
		statusMap[dbType] = isActive
	}
	c.JSON(http.StatusOK, statusMap)
}

func handleDatabaseQuery(c *gin.Context) {
	var req database.DBRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	// Logging connection attempt
	connInfo := "Type: " + req.Type
	if strings.Contains(req.ConnectionString, "@") { // Attempt to parse host/user from common formats
		parts := strings.Split(req.ConnectionString, "@")
		if len(parts) > 1 {
			userHost := parts[0]
			hostPort := parts[1]
			connInfo += ", User: " + userHost + ", Host: " + hostPort
		}
	} else { // Assume it's host:port for Redis
		connInfo += ", Host: " + req.ConnectionString
	}
	fmt.Printf("Database: Attempting connection: %s\n", connInfo)

	handler, err := database.GetHandler(req.Type)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := handler.Connect(req.ConnectionString); err != nil {
		// Return the exact driver error
		fmt.Printf("Database: Connection failed for %s: %v\n", connInfo, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Connection failed: " + err.Error()})
		return
	}
	defer handler.Close()
	fmt.Printf("Database: Connection successful for %s\n", connInfo)

	// Pass query and queryTarget to ExecuteQuery
	res, err := handler.ExecuteQuery(req.Query, req.QueryTarget)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

func handleDatabaseSchema(c *gin.Context) {
	var req database.DBRequest // Use DBRequest for connection info
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	handler, err := database.GetHandler(req.Type)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := handler.Connect(req.ConnectionString); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Connection failed: " + err.Error()})
		return
	}
	defer handler.Close()

	schema, err := handler.GetSchema()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, schema)
}
// --- Terminal Handler ---

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func terminalHandler(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	cmd := exec.Command("bash")
	cmd.Env = append(os.Environ(), "TERM=xterm")
	
	ptmx, err := pty.Start(cmd)
	if err != nil {
		conn.WriteMessage(websocket.TextMessage, []byte("Failed to start pty: "+err.Error()))
		return
	}
	defer func() { _ = ptmx.Close() }() 

	go func() {
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				return
			}
			
			if len(message) > 0 {
				switch message[0] {
				case '0': // Input
					if len(message) > 1 {
						ptmx.Write(message[1:])
					}
				case '1': // Resize
					var size struct {
						Cols int `json:"cols"`
						Rows int `json:"rows"`
					}
					if err := json.Unmarshal(message[1:], &size); err == nil {
						pty.Setsize(ptmx, &pty.Winsize{
							Rows: uint16(size.Rows),
							Cols: uint16(size.Cols),
						})
					}
				}
			}
		}
	}()

	buf := make([]byte, 1024)
	for {
		n, err := ptmx.Read(buf)
		if err != nil {
			break
		}
		err = conn.WriteMessage(websocket.BinaryMessage, buf[:n]) 
		if err != nil {
			break
		}
	}
}

// --- Firewall Handler (UFW) ---

func getFirewallStatus(c *gin.Context) {
	cmd := exec.Command("ufw", "status", "numbered")
	out, _ := cmd.CombinedOutput()
	output := string(out)
	
	status := "inactive"
	if strings.Contains(output, "Status: active") {
		status = "active"
	}

	var rules []FirewallRule

	if status == "active" {
		scanner := bufio.NewScanner(strings.NewReader(output))
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "Status:") || strings.Contains(line, "--") || strings.TrimSpace(line) == "" || strings.Contains(line, "To") {
				continue
			}
			cleanLine := strings.ReplaceAll(line, "[", "")
			cleanLine = strings.ReplaceAll(cleanLine, "]", "")
			fields := strings.Fields(cleanLine)
			
			if len(fields) >= 4 {
				rules = append(rules, FirewallRule{
					ID:     fields[0],
					To:     fields[1],
					Action: fields[2] + " " + fields[3], 
					From:   strings.Join(fields[4:], " "),
					Status: status,
				})
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": status,
		"rules":  rules,
	})
}

func addFirewallRule(c *gin.Context) {
	var req struct {
		Port  string `json:"port"`
		Proto string `json:"proto"` 
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	if req.Port == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Port required"})
		return
	}

	args := []string{"allow", req.Port}
	if req.Proto != "" {
		args[1] = req.Port + "/" + req.Proto
	}

	cmd := exec.Command("ufw", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": string(output)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Rule added", "output": string(output)})
}

func deleteFirewallRule(c *gin.Context) {
	var req struct {
		ID string `json:"id"` 
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	cmd := exec.Command("ufw", "--force", "delete", req.ID)
	output, err := cmd.CombinedOutput()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": string(output)})
		return
	}
	
c.JSON(http.StatusOK, gin.H{"message": "Rule deleted"})
}

// --- System Handlers ---

func getSystemInfo(c *gin.Context) {
	cpus, _ := cpu.Info()
	model := ""
	if len(cpus) > 0 {
		model = cpus[0].ModelName
	}
	cores, _ := cpu.Counts(false)
	threads, _ := cpu.Counts(true)
	percent, _ := cpu.Percent(0, false)
	perCore, _ := cpu.Percent(0, true)
	totalUsage := 0.0
	if len(percent) > 0 {
		totalUsage = percent[0]
	}
	v, _ := mem.VirtualMemory()
	d, _ := disk.Usage("/")

	c.JSON(http.StatusOK, SystemInfo{
		CPU: CPUInfo{ModelName: model, Cores: cores, Threads: threads, Usage: totalUsage, UsagePerCore: perCore},
		RAM: RAMInfo{Total: v.Total, Used: v.Used, UsedPercent: v.UsedPercent},
		Disk: DiskInfo{Total: d.Total, Used: d.Used, UsedPercent: d.UsedPercent},
	})
}

func getNetworkInfo(c *gin.Context) {
	ifaces, _ := net.Interfaces()
	var interfaces []InterfaceInfo
	for _, i := range ifaces {
		var ipv4s, ipv6s []string
		for _, addr := range i.Addrs {
			ip := addr.Addr
			if strings.Contains(ip, ":") {
				ipv6s = append(ipv6s, ip)
			} else {
				ipv4s = append(ipv4s, ip)
			}
		}
		interfaces = append(interfaces, InterfaceInfo{Name: i.Name, IPv4: ipv4s, IPv6: ipv6s})
	}
	io, _ := net.IOCounters(false)
	stats := NetStats{}
	if len(io) > 0 {
		stats.BytesSent = io[0].BytesSent
		stats.BytesRecv = io[0].BytesRecv
	}
	publicIP := "Unknown" 
	resp, err := http.Get("https://api.ipify.org")
	if err == nil {
		defer resp.Body.Close()
		body, _ := ioutil.ReadAll(resp.Body)
		publicIP = string(body)
	}

	c.JSON(http.StatusOK, NetworkInfo{Interfaces: interfaces, Stats: stats, PublicIP: publicIP})
}

func getProcesses(c *gin.Context) {
	conns, err := net.Connections("inet")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	var processList []ProcessInfo
	for _, conn := range conns {
		if conn.Status == "LISTEN" || conn.Type == 2 {
			proc, err := process.NewProcess(conn.Pid)
			name := "Unknown"
			if err == nil {
				name, _ = proc.Name()
			}
			protocol := "tcp"
			if conn.Type == 2 {
				protocol = "udp"
			}
			processList = append(processList, ProcessInfo{PID: conn.Pid, Name: name, Port: int(conn.Laddr.Port), Protocol: protocol})
		}
	}
	c.JSON(http.StatusOK, processList)
}

func killProcess(c *gin.Context) {
	var req struct {
		PID int32 `json:"pid"`
	}
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Request"})
		return
	}
	proc, err := process.NewProcess(req.PID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Process not found"})
		return
	}
	err = proc.Kill()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to kill process: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "Killed"})
}

const nginxPath = "/etc/nginx/sites-available/"

func listNginxFiles(c *gin.Context) {
	files, err := ioutil.ReadDir(nginxPath)
	if err != nil {
		c.JSON(http.StatusOK, []string{})
		return
	}
	var names []string
	for _, f := range files {
		if !f.IsDir() {
			names = append(names, f.Name())
		}
	}
	c.JSON(http.StatusOK, names)
}

func getNginxFile(c *gin.Context) {
	name := c.Query("name")
	if name == "" || strings.Contains(name, "..") || strings.Contains(name, "/") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid filename"})
		return
	}
	content, err := ioutil.ReadFile(filepath.Join(nginxPath, name))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"content": string(content)})
}

func saveNginxFile(c *gin.Context) {
	var req NginxFile
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}
	if req.Name == "" || strings.Contains(req.Name, "..") || strings.Contains(req.Name, "/") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid filename"})
		return
	}

	filePath := filepath.Join(nginxPath, req.Name)
	currentContent, err := ioutil.ReadFile(filePath)
	fileExisted := err == nil
	
	err = ioutil.WriteFile(filePath, []byte(req.Content), 0644)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write file"})
		return
	}

	cmd := exec.Command("nginx", "-t")
	output, err := cmd.CombinedOutput()
	if err != nil {
		if fileExisted {
			ioutil.WriteFile(filePath, currentContent, 0644)
		} else {
			os.Remove(filePath)
		}
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "Nginx validation failed", "details": string(output)})
		return
	}

	exec.Command("systemctl", "reload", "nginx").Run()
	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Saved & Reloaded"})
}

const nginxTemplate = `
server {
    listen 80;
    server_name {{.Domain}};

    {{if eq .Type "proxy"}}
    location / {
        proxy_pass http://127.0.0.1:{{.Target}};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    {{else}}
    root {{.Target}};
    index index.html index.htm;
    location / {
        try_files $uri $uri/ =404;
    }
    {{end}}
}
`

func createSite(c *gin.Context) {
	var req CreateSiteRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	// Validation
	domainRegex := regexp.MustCompile(`^(?i)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$`)
	if !domainRegex.MatchString(req.Domain) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid domain format"})
		return
	}
	
	if req.Type != "proxy" && req.Type != "static" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid type"})
		return
	}

	if strings.Contains(req.Target, "..") || strings.Contains(req.Target, ";") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid target"})
		return
	}

	// Generate Config
	tmpl, err := template.New("nginx").Parse(nginxTemplate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Template error"})
		return
	}

	var configBuffer bytes.Buffer
	if err := tmpl.Execute(&configBuffer, req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Template execution error"})
		return
	}

	// Paths
	availablePath := filepath.Join("/etc/nginx/sites-available", req.Domain)
	enabledPath := filepath.Join("/etc/nginx/sites-enabled", req.Domain)

	// Check if exists
	if _, err := os.Stat(availablePath); err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Site configuration already exists"})
		return
	}

	// Write File
	if err := ioutil.WriteFile(availablePath, configBuffer.Bytes(), 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write config file"})
		return
	}

	// Symlink
	if err := os.Symlink(availablePath, enabledPath); err != nil {
		os.Remove(availablePath) // Cleanup
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to enable site (symlink)"})
		return
	}

	// Validate (nginx -t)
	cmd := exec.Command("nginx", "-t")
	if output, err := cmd.CombinedOutput(); err != nil {
		// Rollback
		os.Remove(enabledPath)
		os.Remove(availablePath)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nginx validation failed", "details": string(output)})
		return
	}

	// Reload
	exec.Command("systemctl", "reload", "nginx").Run()

	// SSL (Certbot)
	var certbotOutput string
	if req.SSL {
		certCmd := exec.Command("certbot", "--nginx", "-d", req.Domain, "--non-interactive", "--agree-tos", "--redirect", "-m", "admin@pixelcraft-studio.store")
		out, err := certCmd.CombinedOutput()
		certbotOutput = string(out)
		
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"status": "warning", 
				"message": "Site created but SSL failed", 
				"details": certbotOutput,
			})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "success", 
		"message": "Site created successfully", 
		"ssl_output": certbotOutput,
	})
}

// --- Cloudflare Handler ---

func addDNSRecord(c *gin.Context) {
	var req CloudflareRecordRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	if CloudflareAPIToken == "" || CloudflareZoneID == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cloudflare credentials not configured"})
		return
	}

	// Default TTL if not set or 0
	if req.TTL == 0 {
		req.TTL = 1 // Auto
	}

	payload, _ := json.Marshal(req)
	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/zones/%s/dns_records", CloudflareZoneID)

	client := &http.Client{}
	httpReq, err := http.NewRequest("POST", url, bytes.NewBuffer(payload))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request"})
		return
	}

	httpReq.Header.Set("Authorization", "Bearer "+CloudflareAPIToken)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to contact Cloudflare: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)
	
	// Passthrough the Cloudflare response for now, or parse it to check success
	var cfResp map[string]interface{}
	json.Unmarshal(body, &cfResp)

	success, _ := cfResp["success"].(bool)
	if !success {
		c.JSON(http.StatusBadRequest, gin.H{
			"status": "error",
			"message": "Cloudflare API Error",
			"details": cfResp,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "DNS Record Added", "data": cfResp})
}

func listDNSRecords(c *gin.Context) {
	if CloudflareAPIToken == "" || CloudflareZoneID == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Cloudflare credentials not configured"})
		return
	}

	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/zones/%s/dns_records?per_page=100", CloudflareZoneID)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+CloudflareAPIToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch records"})
		return
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", body)
}

func updateDNSRecord(c *gin.Context) {
	id := c.Param("id")
	var req CloudflareRecordRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON"})
		return
	}

	// TTL fix
	if req.TTL == 0 {
		req.TTL = 1
	}

	payload, _ := json.Marshal(req)
	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/zones/%s/dns_records/%s", CloudflareZoneID, id)

	httpReq, _ := http.NewRequest("PUT", url, bytes.NewBuffer(payload))
	httpReq.Header.Set("Authorization", "Bearer "+CloudflareAPIToken)
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update record"})
		return
	}
	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", body)
}

func deleteDNSRecord(c *gin.Context) {
	id := c.Param("id")
	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/zones/%s/dns_records/%s", CloudflareZoneID, id)

	httpReq, _ := http.NewRequest("DELETE", url, nil)
	httpReq.Header.Set("Authorization", "Bearer "+CloudflareAPIToken)
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete record"})
		return
	}
	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", body)
}