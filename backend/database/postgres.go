package database

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"

	_ "github.com/lib/pq"
)

type PostgresHandler struct {
	db *sql.DB
}

func (h *PostgresHandler) Connect(connStr string) error {
	var err error
	h.db, err = sql.Open("postgres", connStr)
	if err != nil {
		fmt.Printf("Postgres Connect Error: %v\n", err) // Added log
		return err
	}
	if err = h.db.Ping(); err != nil {
		fmt.Printf("Postgres Ping Error: %v\n", err) // Added log
		return err
	}
	return nil
}

func (h *PostgresHandler) Close() error {
	if h.db != nil {
		return h.db.Close()
	}
	return nil
}

func (h *PostgresHandler) GetSchema() (*DBSchema, error) {
	query := "SELECT table_name::text FROM information_schema.tables WHERE table_schema = 'public'"

rows, err := h.db.Query(query)
	if err != nil {
		fmt.Printf("Postgres GetSchema Query Error: %v\n", err) // Detailed error log
		return nil, fmt.Errorf("failed to query tables: %w", err)
	}
	defer rows.Close()

	var schema DBSchema
	for rows.Next() {
		var tableName string
		if err := rows.Scan(&tableName); err != nil {
			fmt.Printf("Postgres GetSchema Scan Error: %v\n", err) // Detailed error log
			return nil, fmt.Errorf("failed to scan table name: %w", err)
		}
		schema.Entries = append(schema.Entries, SchemaEntry{Name: tableName, Type: "table"})
	}
	
	if err := rows.Err(); err != nil {
		fmt.Printf("Postgres GetSchema Rows Error after iteration: %v\n", err) // Detailed error log for any errors during iteration
		return nil, fmt.Errorf("error during table iteration: %w", err)
	}

	return &schema, nil
}

func (h *PostgresHandler) ExecuteQuery(query string, queryTarget string) (*QueryResult, error) {
	if query == "EXPLORE_TABLE" {
		if queryTarget == "" {
			return nil, errors.New("table name must be provided for EXPLORE_TABLE")
		}
		// Basic sanitization for table name
		if strings.ContainsAny(queryTarget, ";'\"`") {
			return nil, errors.New("invalid characters in table name")
		}
		query = fmt.Sprintf("SELECT * FROM %s LIMIT 50", queryTarget)
	}

	// Basic security check for other queries
	dangerous := []string{"DROP", "DELETE", "TRUNCATE", "ALTER", "GRANT"}
	upperQuery := strings.ToUpper(query)
	for _, word := range dangerous {
		if strings.Contains(upperQuery, word) {
			// Simple check: if it doesn't have FORCE -- comment (fake flag logic for demo)
			if !strings.Contains(upperQuery, "--FORCE") {
				return nil, errors.New("destructive command detected. Use --FORCE to override (Not recommended)")
			}
		}
	}


rows, err := h.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	var resultRows []map[string]interface{}

	for rows.Next() {
		// Create a slice of interface{}'s to represent each column,
		// and a second slice to contain pointers to each item in the columns slice.
		columnsPtrs := make([]interface{}, len(columns))
		columnValues := make([]interface{}, len(columns))

		for i := range columnValues {
			columnsPtrs[i] = &columnValues[i]
		}

		if err := rows.Scan(columnsPtrs...); err != nil {
			return nil, err
		}

		// Create map
		rowMap := make(map[string]interface{})
		for i, colName := range columns {
			val := columnValues[i]

			b, ok := val.([]byte)
			if ok {
				rowMap[colName] = string(b)
			} else {
				rowMap[colName] = val
			}
		}
		resultRows = append(resultRows, rowMap)
	}

	return &QueryResult{
		Columns: columns,
		Rows:    resultRows,
		Message: fmt.Sprintf("Query executed successfully. %d rows returned.", len(resultRows)),
	}, nil
}