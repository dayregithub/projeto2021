package main

import (
	"crypto/rand"
	"crypto/subtle"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

const address = "127.0.0.1:47831"
const localOrigin = "http://" + address

//go:embed setup.html
var setupHTML string

type config struct {
	Token string `json:"token"`
	Root  string `json:"root"`
}
type application struct {
	mu         sync.Mutex
	cfg        config
	configPath string
	stop       func()
	openFolder func(string) error
}

func loadConfig(path, root string) (config, error) {
	var c config
	data, err := os.ReadFile(path)
	if err == nil {
		err = json.Unmarshal(data, &c)
		if err != nil || len(c.Token) != 43 || !filepath.IsAbs(c.Root) {
			return c, errors.New("Configuração inválida; não foi alterada.")
		}
		return c, nil
	}
	if !os.IsNotExist(err) {
		return c, err
	}
	token := make([]byte, 32)
	if _, err = rand.Read(token); err != nil {
		return c, err
	}
	c = config{base64.RawURLEncoding.EncodeToString(token), root}
	return c, saveConfig(path, c)
}
func saveConfig(path string, c config) error {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(c, "", "  ")
	return atomicWrite(path, data)
}
func atomicWrite(path string, data []byte) error {
	file, err := os.CreateTemp(filepath.Dir(path), ".papeled-*")
	if err != nil {
		return err
	}
	name := file.Name()
	defer os.Remove(name)
	if _, err = file.Write(data); err != nil {
		file.Close()
		return err
	}
	if err = file.Close(); err != nil {
		return err
	}
	return os.Rename(name, path)
}
func allowedOrigin(origin string) bool {
	return origin == localOrigin || origin == "https://papeledmaker.vercel.app" || origin == "https://maker.papeled.com.br" || origin == "https://dayregithub.github.io"
}
func respond(w http.ResponseWriter, code int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(value)
}
func failure(w http.ResponseWriter, code int, text string) {
	respond(w, code, map[string]string{"error": text})
}
func (a *application) handler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	if r.Host != address {
		failure(w, 403, "Host não permitido.")
		return
	}
	origin := r.Header.Get("Origin")
	if origin != "" && !allowedOrigin(origin) {
		failure(w, 403, "Site não autorizado.")
		return
	}
	if allowedOrigin(origin) {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Private-Network", "true")
	}
	if r.Method == "OPTIONS" {
		if !allowedOrigin(origin) {
			failure(w, 403, "Origem obrigatória.")
			return
		}
		w.WriteHeader(204)
		return
	}
	if r.URL.Path == "/" && r.Method == "GET" {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
		io.WriteString(w, setupHTML)
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if subtle.ConstantTimeCompare([]byte(token), []byte(a.cfg.Token)) != 1 {
		failure(w, 401, "Código de vinculação inválido. Abra o aplicativo e copie o código novamente.")
		return
	}
	if r.URL.Path == "/status" && r.Method == "GET" {
		respond(w, 200, map[string]any{"name": "Papeled Maker Arquivador", "version": 1, "root": a.cfg.Root, "capabilities": []string{"open-folder", "rename-folder"}})
		return
	}
	if r.Method != "POST" || !allowedOrigin(origin) || !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		failure(w, 405, "Requisição inválida.")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 30<<20)
	switch r.URL.Path {
	case "/stop":
		if origin != localOrigin {
			failure(w, 403, "Comando somente local.")
			return
		}
		respond(w, 200, map[string]bool{"stopped": true})
		if a.stop != nil {
			a.stop()
		}

	case "/settings":
		var data struct {
			Root string `json:"root"`
		}
		if err := decode(r, &data); err != nil {
			failure(w, 400, "Pasta inválida.")
			return
		}
		data.Root = strings.TrimSpace(data.Root)
		if !filepath.IsAbs(data.Root) || len(data.Root) > 220 || strings.HasPrefix(data.Root, `\\`) {
			failure(w, 400, "Informe um caminho absoluto de uma pasta local, como C:\\Users\\SeuNome\\Documents\\Papeled Maker\\Orçamentos.")
			return
		}
		if err := os.MkdirAll(data.Root, 0700); err != nil {
			failure(w, 400, "Não foi possível criar a pasta. Verifique o caminho e a permissão do Windows.")
			return
		}
		next := a.cfg
		next.Root = filepath.Clean(data.Root)
		if err := saveConfig(a.configPath, next); err != nil {
			failure(w, 500, "Não foi possível guardar a configuração.")
			return
		}
		a.cfg = next
		respond(w, 200, map[string]string{"root": a.cfg.Root})
	case "/folder-state":
		var data struct {
			Number string `json:"number"`
			State  string `json:"state"`
		}
		if err := decode(r, &data); err != nil {
			failure(w, 400, "Estado de pasta inválido.")
			return
		}
		path, err := a.renameArchive(data.Number, data.State)
		if errors.Is(err, errArchiveMissing) {
			respond(w, 200, map[string]any{"skipped": true, "message": "Pasta não localizada neste computador; nenhum arquivo foi alterado."})
			return
		}
		if err != nil {
			failure(w, 409, err.Error())
			return
		}
		respond(w, 200, map[string]string{"path": path})
	case "/open-folder":
		var data struct {
			Number string `json:"number"`
		}
		if err := decode(r, &data); err != nil {
			failure(w, 400, "Número do orçamento inválido.")
			return
		}
		path, err := a.resolveArchive(data.Number)
		if err != nil {
			failure(w, 404, err.Error())
			return
		}
		if a.openFolder == nil {
			failure(w, 501, "Abrir pastas está disponível no aplicativo Windows.")
			return
		}
		if err := a.openFolder(path); err != nil {
			failure(w, 500, "Não foi possível iniciar o Explorador de Arquivos.")
			return
		}
		respond(w, 200, map[string]string{"path": path})
	case "/archive":
		var data archiveRequest
		if err := decode(r, &data); err != nil {
			failure(w, 400, "Arquivos inválidos ou maiores que o limite de 30 MB.")
			return
		}
		var existing string
		if path, err := a.resolveArchive(data.Number); err == nil && filepath.Base(path) != data.Number {
			if filepath.Base(path) == data.Number+" - DELETADO" {
				failure(w, 409, "A pasta está marcada como DELETADO. Use um novo número para outro orçamento.")
				return
			}
			existing = path
		}
		path, err := storeArchive(a.cfg.Root, data, existing)
		if err != nil {
			failure(w, 400, err.Error())
			return
		}
		if err := a.rememberArchive(data.Number, path); err != nil {
			failure(w, 500, "Arquivos gravados, mas não foi possível registrar o caminho da pasta. Tente arquivar novamente.")
			return
		}
		respond(w, 200, map[string]string{"path": path})
	default:
		failure(w, 404, "Recurso não encontrado.")
	}
}
func decode(r *http.Request, value any) error {
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(value); err != nil {
		return err
	}
	if d.Decode(&struct{}{}) != io.EOF {
		return errors.New("Dados extras")
	}
	return nil
}

type archiveRequest struct {
	Number string          `json:"number"`
	PDF    []byte          `json:"pdf"`
	Quote  json.RawMessage `json:"quote"`
}

var errArchiveMissing = errors.New("A pasta deste orçamento não foi encontrada neste computador. Arquive-o primeiro ou verifique se a pasta foi movida ou excluída.")

var safeNumber = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,100}$`)
var reserved = regexp.MustCompile(`(?i)^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])$`)

func storeArchive(root string, data archiveRequest, existing ...string) (string, error) {
	if !safeNumber.MatchString(data.Number) || reserved.MatchString(data.Number) {
		return "", errors.New("Número do orçamento inválido para criar uma pasta no Windows.")
	}
	if len(data.PDF) < 5 || len(data.PDF) > 20<<20 || !strings.HasPrefix(string(data.PDF[:5]), "%PDF-") {
		return "", errors.New("PDF inválido ou maior que 20 MB.")
	}
	var exported struct {
		Type  string `json:"type"`
		Quote struct {
			Number string `json:"number"`
		} `json:"quote"`
	}
	if len(data.Quote) > 8<<20 || json.Unmarshal(data.Quote, &exported) != nil || exported.Type != "papeled-estimate" || exported.Quote.Number != data.Number {
		return "", errors.New("A cópia editável não corresponde ao orçamento.")
	}
	target := filepath.Join(root, data.Number)
	if len(existing) > 0 && existing[0] != "" {
		target = existing[0]
	}
	if err := os.MkdirAll(root, 0700); err != nil {
		return "", errors.New("Não foi possível abrir a pasta principal.")
	}
	if info, err := os.Lstat(target); err == nil && (!info.IsDir() || info.Mode()&os.ModeSymlink != 0) {
		return "", errors.New("A pasta do orçamento é um atalho ou arquivo. Escolha outro destino.")
	}
	if err := os.MkdirAll(target, 0700); err != nil {
		return "", errors.New("Não foi possível criar a pasta do orçamento.")
	}
	files := map[string][]byte{"orcamento-" + data.Number + ".pdf": data.PDF, "orcamento-editavel.json": data.Quote, "LEIA-ME.txt": []byte("Papeled Maker\r\nPara editar, importe orcamento-editavel.json no painel. Este JSON contém custos internos e dados pessoais. Envie ao cliente apenas o PDF. Repetir o arquivamento atualiza estes arquivos.\r\n")}
	for name, bytes := range files {
		path := filepath.Join(target, name)
		if info, err := os.Lstat(path); err == nil && (!info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0) {
			return "", errors.New("Arquivo de destino inválido.")
		}
		if err := atomicWrite(path, bytes); err != nil {
			return "", fmt.Errorf("Não foi possível gravar %s. Feche o arquivo se estiver aberto e tente novamente.", name)
		}
	}
	return target, nil
}
func httpServer(a *application) *http.Server {
	return &http.Server{Addr: address, Handler: http.HandlerFunc(a.handler), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 30 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 8192}
}

// Local index preserves the actual folder when the default destination changes.
func (a *application) archiveIndex() (map[string]string, error) {
	data, err := os.ReadFile(filepath.Join(filepath.Dir(a.configPath), "archives.json"))
	index := map[string]string{}
	if os.IsNotExist(err) {
		return index, nil
	}
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(data, &index); err != nil || index == nil {
		return nil, errors.New("O índice local de pastas não pôde ser lido.")
	}
	return index, nil
}
func (a *application) rememberArchive(number, path string) error {
	index, err := a.archiveIndex()
	if err != nil {
		return err
	}
	index[number] = path
	data, err := json.MarshalIndent(index, "", "  ")
	if err != nil {
		return err
	}
	return atomicWrite(filepath.Join(filepath.Dir(a.configPath), "archives.json"), data)
}
func (a *application) resolveArchive(number string) (string, error) {
	if !safeNumber.MatchString(number) || reserved.MatchString(number) {
		return "", errors.New("Número do orçamento inválido.")
	}
	index, err := a.archiveIndex()
	if err != nil {
		return "", err
	}
	path := index[number]
	if path == "" {
		path = filepath.Join(a.cfg.Root, number)
	}
	if !filepath.IsAbs(path) || !validFolderName(filepath.Base(path), number) {
		return "", errors.New("Caminho registrado inválido.")
	}
	info, err := os.Lstat(path)
	if os.IsNotExist(err) {
		return "", errArchiveMissing
	}
	if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return "", errors.New("Não foi possível acessar a pasta do orçamento. Verifique as permissões e se ela é uma pasta válida.")
	}
	return path, nil
}

func validFolderName(name, number string) bool {
	return name == number || name == number+" - CANCELADO" || name == number+" - DELETADO"
}
func (a *application) renameArchive(number, state string) (string, error) {
	suffix, ok := map[string]string{"cancelled": " - CANCELADO", "deleted": " - DELETADO", "active": ""}[state]
	if !ok {
		return "", errors.New("Estado de pasta inválido.")
	}
	source, err := a.resolveArchive(number)
	if err != nil {
		return "", err
	}
	if filepath.Base(source) == number+" - DELETADO" && state != "deleted" {
		return "", errors.New("Esta pasta já foi marcada como DELETADO e não será reclassificada.")
	}
	target := filepath.Join(filepath.Dir(source), number+suffix)
	if target == source {
		return target, nil
	}
	if _, err := os.Lstat(target); !os.IsNotExist(err) {
		return "", errors.New("Já existe uma pasta com o nome de destino, ou não foi possível verificá-la. Nenhuma pasta foi substituída.")
	}
	if err := os.Rename(source, target); err != nil {
		return "", errors.New("Não foi possível renomear a pasta. Feche arquivos em uso e verifique as permissões do Windows.")
	}
	if err := a.rememberArchive(number, target); err != nil {
		if rollback := os.Rename(target, source); rollback != nil {
			return "", fmt.Errorf("A pasta foi renomeada para %s, mas o índice não pôde ser atualizado. Verifique-a no Explorador.", target)
		}
		return "", errors.New("Não foi possível registrar o novo caminho. O nome anterior foi mantido.")
	}
	return target, nil
}
