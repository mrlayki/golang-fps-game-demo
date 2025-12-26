package repository

import (
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"

	"fps-webapp/internal/model"
)

type UserRepo struct {
	db *gorm.DB
}

func NewUserRepo(db *gorm.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) Create(ctx context.Context, u *model.User) error {
	if err := r.db.WithContext(ctx).Create(u).Error; err != nil {
		if isUniqueErr(err) {
			return ErrConflict
		}
		return err
	}
	return nil
}

func (r *UserRepo) GetByID(ctx context.Context, id string) (*model.User, error) {
	var u model.User
	err := r.db.WithContext(ctx).First(&u, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &u, nil
}

func (r *UserRepo) List(ctx context.Context, limit, offset int) ([]model.User, error) {
	var out []model.User
	err := r.db.WithContext(ctx).
		Order("created_at desc").
		Limit(limit).
		Offset(offset).
		Find(&out).Error
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (r *UserRepo) UpdateName(ctx context.Context, id, name string) (*model.User, error) {
	u, err := r.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	u.Name = name
	if err := r.db.WithContext(ctx).Save(u).Error; err != nil {
		return nil, err
	}
	return u, nil
}

func (r *UserRepo) Delete(ctx context.Context, id string) error {
	res := r.db.WithContext(ctx).Delete(&model.User{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// isUniqueErr is a lightweight demo for sqlite. In real production code, use driver-specific
// error checks or GORM's error translation features.
func isUniqueErr(err error) bool {
	if err == nil {
		return false
	}
	s := err.Error()
	return strings.Contains(s, "UNIQUE") || strings.Contains(strings.ToLower(s), "unique")
}
