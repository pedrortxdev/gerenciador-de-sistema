package database

type QueryResult struct {
	Columns []string                 `json:"columns"`
	Rows    []map[string]interface{} `json:"rows"`
	Message string                   `json:"message,omitempty"`
}

type SchemaEntry struct {
	Name string `json:"name"`
	Type string `json:"type"` // e.g., "table", "view", "string", "hash"
}

type DBSchema struct {
	Entries []SchemaEntry `json:"entries"`
}

type DBHandler interface {
	Connect(connStr string) error
	GetSchema() (*DBSchema, error)
	ExecuteQuery(query string, queryTarget string) (*QueryResult, error) // Updated for queryTarget
	Close() error
}

type DBRequest struct {
	Type             string `json:"type"`
	ConnectionString string `json:"connection_string"`
	Query            string `json:"query"`
	QueryTarget      string `json:"query_target,omitempty"` // New field
}
