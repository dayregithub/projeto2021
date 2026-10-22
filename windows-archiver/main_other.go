//go:build !windows

package main

// Integration-test host. The distributed installer is built only for Windows.
import (
	"log"
	"os"
	"path/filepath"
)

func main() {
	dir := os.Getenv("PAPELED_ARCHIVER_TEST_DIR")
	if dir == "" {
		log.Fatal("Este aplicativo é distribuído para Windows.")
	}
	path := filepath.Join(dir, "config.json")
	cfg, err := loadConfig(path, filepath.Join(dir, "Orcamentos"))
	if err != nil {
		log.Fatal(err)
	}
	log.Fatal(httpServer(&application{cfg: cfg, configPath: path}).ListenAndServe())
}
