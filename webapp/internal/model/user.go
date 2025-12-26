package model

import "time"

// User is a classic GORM model example (UUID string id).
// Keep it small for learning; add more fields as your domain grows.
type User struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	Name      string    `gorm:"not null;size:64;index" json:"name"`
	Email     string    `gorm:"not null;size:120;uniqueIndex" json:"email"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

