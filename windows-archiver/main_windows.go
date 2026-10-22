//go:build windows

package main

import (
	"bytes"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"
)

func quiet(name string, args ...string) *exec.Cmd {
	c := exec.Command(name, args...)
	c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	return c
}
func notify(message string) {
	title, _ := syscall.UTF16PtrFromString("Papeled Maker Arquivador")
	text, _ := syscall.UTF16PtrFromString(message)
	syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(text)), uintptr(unsafe.Pointer(title)), 0)
}
func documents() (string, error) {
	var path [260]uint16
	// CSIDL_PERSONAL resolves redirected Documents/OneDrive folders for this user.
	result, _, _ := syscall.NewLazyDLL("shell32.dll").NewProc("SHGetFolderPathW").Call(0, 5, 0, 0, uintptr(unsafe.Pointer(&path[0])))
	if result != 0 {
		return "", fmt.Errorf("Não foi possível localizar Documentos do usuário (%d).", result)
	}
	return syscall.UTF16ToString(path[:]), nil
}
func psQuote(s string) string { return "'" + strings.ReplaceAll(s, "'", "''") + "'" }
func shortcuts(exe, menu string) error {
	if err := os.MkdirAll(menu, 0700); err != nil {
		return err
	}
	script := "$w=New-Object -ComObject WScript.Shell;"
	for name, arg := range map[string]string{"Papeled Maker Arquivador": "--open", "Parar arquivador": "--stop", "Desinstalar arquivador": "--uninstall"} {
		script += "$s=$w.CreateShortcut(" + psQuote(filepath.Join(menu, name+".lnk")) + ");$s.TargetPath=" + psQuote(exe) + ";$s.Arguments=" + psQuote(arg) + ";$s.WorkingDirectory=" + psQuote(filepath.Dir(exe)) + ";$s.Save();"
	}
	return quiet("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script).Run()
}
func openSetup(token string) {
	quiet("rundll32.exe", "url.dll,FileProtocolHandler", localOrigin+"/#"+token).Start()
}
func stop(token string) {
	req, _ := http.NewRequest("POST", localOrigin+"/stop", bytes.NewBufferString("{}"))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", localOrigin)
	client := http.Client{Timeout: 3 * time.Second}
	res, err := client.Do(req)
	if err == nil {
		res.Body.Close()
	}
}
func main() {
	if err := run(); err != nil {
		notify(err.Error())
	}
}
func run() error {
	userConfig, err := os.UserConfigDir()
	if err != nil {
		return err
	}
	local := os.Getenv("LOCALAPPDATA")
	if local == "" {
		return fmt.Errorf("Pasta de aplicativos do usuário não encontrada.")
	}
	appdir := filepath.Join(local, "PapeledMaker", "Arquivador")
	installed := filepath.Join(appdir, "PapeledMakerArquivador.exe")
	configPath := filepath.Join(appdir, "config.json")
	docs, err := documents()
	if err != nil {
		return err
	}
	cfg, err := loadConfig(configPath, filepath.Join(docs, "Papeled Maker", "Orçamentos"))
	if err != nil {
		return err
	}
	menu := filepath.Join(userConfig, "Microsoft", "Windows", "Start Menu", "Programs", "Papeled Maker")
	mode := ""
	if len(os.Args) > 1 {
		mode = os.Args[1]
	}
	if mode == "--stop" {
		stop(cfg.Token)
		notify("Arquivador parado. Para retomar, abra Papeled Maker Arquivador pelo menu Iniciar.")
		return nil
	}
	if mode == "--uninstall" {
		stop(cfg.Token)
		quiet("reg.exe", "delete", `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, "/v", "PapeledMakerArquivador", "/f").Run()
		for _, n := range []string{"Papeled Maker Arquivador", "Parar arquivador", "Desinstalar arquivador"} {
			os.Remove(filepath.Join(menu, n+".lnk"))
		}
		os.Remove(menu)
		// Remove only our executable/config after this process exits. Never remove quote folders.
		script := "Start-Sleep -Seconds 2;Remove-Item -LiteralPath " + psQuote(installed) + " -Force -ErrorAction SilentlyContinue;Remove-Item -LiteralPath " + psQuote(configPath) + " -Force -ErrorAction SilentlyContinue"
		notify("O arquivador será removido após fechar esta mensagem. As pastas dos orçamentos serão preservadas. Desvincule o aplicativo também no painel web.")
		if err := quiet("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", script).Start(); err != nil {
			return fmt.Errorf("A inicialização automática foi removida, mas não foi possível remover os arquivos do aplicativo: %w", err)
		}
		return nil
	}
	if mode != "--serve" && mode != "--open" {
		exe, err := os.Executable()
		if err != nil {
			return err
		}
		stop(cfg.Token)
		if !strings.EqualFold(exe, installed) {
			data, err := os.ReadFile(exe)
			if err != nil {
				return err
			}
			var writeErr error
			for i := 0; i < 10; i++ {
				writeErr = os.WriteFile(installed, data, 0700)
				if writeErr == nil {
					break
				}
				time.Sleep(300 * time.Millisecond)
			}
			if writeErr != nil {
				return fmt.Errorf("Feche o arquivador antigo e tente instalar novamente: %w", writeErr)
			}
		}
		if err := quiet("reg.exe", "add", `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, "/v", "PapeledMakerArquivador", "/t", "REG_SZ", "/d", `"`+installed+`" --serve`, "/f").Run(); err != nil {
			return fmt.Errorf("Não foi possível configurar a inicialização: %w", err)
		}
		if err := shortcuts(installed, menu); err != nil {
			return fmt.Errorf("Não foi possível criar os atalhos: %w", err)
		}
		return quiet(installed, "--open").Start()
	}
	listener, err := net.Listen("tcp4", address)
	if err != nil {
		client := http.Client{Timeout: 2 * time.Second}
		req, _ := http.NewRequest("GET", localOrigin+"/status", nil)
		req.Header.Set("Authorization", "Bearer "+cfg.Token)
		response, checkErr := client.Do(req)
		if checkErr == nil {
			response.Body.Close()
			if response.StatusCode == 200 {
				if mode == "--open" {
					openSetup(cfg.Token)
				}
				return nil
			}
		}
		return fmt.Errorf("A porta local 47831 está ocupada. Feche o outro aplicativo e tente novamente.")
	}
	a := &application{cfg: cfg, configPath: configPath}
	server := httpServer(a)
	a.stop = func() { go server.Close() }
	if mode == "--open" {
		go func() { time.Sleep(250 * time.Millisecond); openSetup(cfg.Token) }()
	}
	err = server.Serve(listener)
	if err == http.ErrServerClosed {
		return nil
	}
	return err
}
