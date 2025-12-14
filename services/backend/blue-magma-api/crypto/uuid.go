package crypto

import (
	"github.com/google/uuid"
	"github.com/mr-tron/base58"
)

func GenerateUUID() (string, error) {
	u, err := uuid.NewRandom()
	if err != nil {
		return "", err
	}
	encoded := base58.Encode(u[:])
	return encoded, nil
}
