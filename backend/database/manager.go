package database

import (
	"errors"
)

func GetHandler(dbType string) (DBHandler, error) {
	switch dbType {
	case "postgres":
		return &PostgresHandler{}, nil
	case "redis":
		return &RedisHandler{}, nil
	default:
		return nil, errors.New("unsupported database type")
	}
}
