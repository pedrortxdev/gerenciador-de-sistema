package database

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/redis/go-redis/v9"
)

type RedisHandler struct {
	client *redis.Client
	ctx    context.Context
}

func (h *RedisHandler) Connect(connStr string) error {
	h.ctx = context.Background()
	
	opt, err := redis.ParseURL(connStr)
	if err != nil {
		fmt.Printf("Redis Connect: Failed to parse connection string '%s': %v\n", connStr, err) // Added log
		// Fallback to simple host assumption if not URL
		opt = &redis.Options{
			Addr: connStr,
		}
	}

	h.client = redis.NewClient(opt)

pingErr := h.client.Ping(h.ctx).Err()
	if pingErr != nil {
		fmt.Printf("Redis Connect: Failed to ping Redis at '%s': %v\n", opt.Addr, pingErr) // Added log
	}
	return pingErr
}

func (h *RedisHandler) Close() error {
	if h.client != nil {
		return h.client.Close()
	}
	return nil
}

func (h *RedisHandler) GetSchema() (*DBSchema, error) {
	var cursor uint64
	var keys []string
	var err error
	const scanCount = 100 // Limit initial keys to avoid blocking for large dbs

	var schema DBSchema
	
	fmt.Printf("Redis GetSchema: Starting SCAN for keys with scanCount=%d\n", scanCount) // Added log
	// Use SCAN to get keys iteratively
	for {
		var batch []string
		batch, cursor, err = h.client.Scan(h.ctx, cursor, "*", scanCount).Result()
		if err != nil {
			fmt.Printf("Redis GetSchema: Error during SCAN at cursor %d: %v\n", cursor, err) // Detailed error log
			return nil, fmt.Errorf("redis SCAN failed: %w", err)
		}
		keys = append(keys, batch...)
		if cursor == 0 {
			fmt.Printf("Redis GetSchema: SCAN completed. Found %d keys so far.\n", len(keys)) // Added log
			break
		}
		if len(keys) >= scanCount { 
			fmt.Printf("Redis GetSchema: Reached scanCount limit (%d keys). Stopping SCAN.\n", len(keys)) // Added log
			break
		}
	}

	for _, key := range keys {
		keyType, err := h.client.Type(h.ctx, key).Result()
		if err != nil {
			fmt.Printf("Redis GetSchema: Failed to get type for key '%s': %v\n", key, err) // Detailed error log
			keyType = "unknown"
		} else {
			fmt.Printf("Redis GetSchema: Key '%s' has type '%s'\n", key, keyType) // Added log
		}
		schema.Entries = append(schema.Entries, SchemaEntry{Name: key, Type: keyType})
	}

	return &schema, nil
}

func (h *RedisHandler) ExecuteQuery(query string, queryTarget string) (*QueryResult, error) {
	dangerous := []string{"FLUSHALL", "FLUSHDB"}
	upperQuery := strings.ToUpper(query)
	for _, word := range dangerous {
		if strings.Contains(upperQuery, word) {
			return nil, errors.New("destructive command blocked")
		}
	}

	if query == "EXPLORE_TABLE" { // For Redis, "table" means key
		if queryTarget == "" {
			return nil, errors.New("key name must be provided for EXPLORE_TABLE")
		}
		keyType, err := h.client.Type(h.ctx, queryTarget).Result()
		if err != nil {
			return nil, fmt.Errorf("failed to get type for key '%s': %v", queryTarget, err)
		}

		var result interface{}
		var newQuery string
		var rows []map[string]interface{}
		var columns []string

		switch keyType {
		case "string":
			val, err := h.client.Get(h.ctx, queryTarget).Result()
			if err != nil {
				return nil, err
			}
			result = val
			newQuery = fmt.Sprintf("GET %s", queryTarget)
		
rows = []map[string]interface{}{{"Key": queryTarget, "Value": result}}
			columns = []string{"Key", "Value"}
		case "hash":
			val, err := h.client.HGetAll(h.ctx, queryTarget).Result()
			if err != nil {
				return nil, err
			}
			result = val
			newQuery = fmt.Sprintf("HGETALL %s", queryTarget)
			if len(val) > 0 {
				columns = []string{"Field", "Value"}
				for field, value := range val {
				
rows = append(rows, map[string]interface{}{"Field": field, "Value": value})
				}
			} else {
			
rows = []map[string]interface{}{}
			}
		case "list":
			val, err := h.client.LRange(h.ctx, queryTarget, 0, 99).Result() // Limit to first 100 elements
			if err != nil {
				return nil, err
			}
			result = val
			newQuery = fmt.Sprintf("LRANGE %s 0 99", queryTarget)
			columns = []string{"Index", "Value"}
			for i, value := range val {
			
rows = append(rows, map[string]interface{}{"Index": i, "Value": value})
			}
		case "set":
			val, err := h.client.SMembers(h.ctx, queryTarget).Result()
			if err != nil {
				return nil, err
			}
			result = val
			newQuery = fmt.Sprintf("SMEMBERS %s", queryTarget)
			columns = []string{"Member"}
			for _, value := range val {
			
rows = append(rows, map[string]interface{}{"Member": value})
			}
		case "zset":
			val, err := h.client.ZRangeWithScores(h.ctx, queryTarget, 0, 99).Result() // Limit to first 100 elements
			if err != nil {
				return nil, err
			}
			result = val
			newQuery = fmt.Sprintf("ZRANGE %s 0 99 WITHSCORES", queryTarget)
			columns = []string{"Member", "Score"}
			for _, z := range val {
			
rows = append(rows, map[string]interface{}{"Member": z.Member, "Score": z.Score})
			}
		default:
			return nil, fmt.Errorf("unsupported Redis key type for exploration: %s", keyType)
		}
		
		return &QueryResult{
			Columns: columns,
			Rows:    rows,
			Message: fmt.Sprintf("Explored key '%s' (type: %s) with command: %s", queryTarget, keyType, newQuery),
		}, nil
	}

	// For general Redis commands
	// Split command by spaces (rudimentary parsing)
	// e.g., "SET key value" -> ["SET", "key", "value"]
	parts := strings.Fields(query)
	if len(parts) == 0 {
		return nil, errors.New("empty command")
	}

	// Convert to interface{} slice for Do
	args := make([]interface{}, len(parts))
	for i, v := range parts {
		args[i] = v
	}

	val, err := h.client.Do(h.ctx, args...).Result()
	if err != nil {
		return nil, err
	}

	// Format result to fit QueryResult structure
	// We treat Redis result as a single row with "Result" column
	resultStr := fmt.Sprintf("%v", val)
	

rows := []map[string]interface{}{
		{"Result": resultStr, "Raw": val},
	}

	return &QueryResult{
		Columns: []string{"Result", "Raw"},
		Rows:    rows,
		Message: "Command executed",
	}, nil
}