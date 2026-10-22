package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func testApp(t *testing.T) *application {
	t.Helper()
	base := t.TempDir()
	path := filepath.Join(base, "config.json")
	c, err := loadConfig(path, filepath.Join(base, "Orçamentos"))
	if err != nil {
		t.Fatal(err)
	}
	return &application{cfg: c, configPath: path}
}
func call(a *application, method, path, origin, token string, body []byte) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, localOrigin+path, bytes.NewReader(body))
	r.Host = address
	if origin != "" {
		r.Header.Set("Origin", origin)
	}
	if token != "" {
		r.Header.Set("Authorization", "Bearer "+token)
	}
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	a.handler(w, r)
	return w
}
func payload(number, customer string) archiveRequest {
	return archiveRequest{number, []byte("%PDF-1.3 test"), json.RawMessage(`{"type":"papeled-estimate","quote":{"number":"` + number + `","customer":"` + customer + `"}}`)}
}
func TestArchiveAndUpdate(t *testing.T) {
	a := testApp(t)
	for _, customer := range []string{"Primeiro", "Atualizado"} {
		data, _ := json.Marshal(payload("PM-20261022-ABC123", customer))
		w := call(a, "POST", "/archive", "https://papeledmaker.vercel.app", a.cfg.Token, data)
		if w.Code != 200 {
			t.Fatalf("%d %s", w.Code, w.Body.String())
		}
	}
	path := filepath.Join(a.cfg.Root, "PM-20261022-ABC123")
	data, err := os.ReadFile(filepath.Join(path, "orcamento-editavel.json"))
	if err != nil || !strings.Contains(string(data), "Atualizado") {
		t.Fatalf("file %s %v", data, err)
	}
	if _, err := os.Stat(filepath.Join(path, "orcamento-PM-20261022-ABC123.pdf")); err != nil {
		t.Fatal(err)
	}
	entries, _ := os.ReadDir(path)
	if len(entries) != 3 {
		t.Fatalf("unexpected files: %d", len(entries))
	}
}
func TestAuthorizationAndOrigins(t *testing.T) {
	a := testApp(t)
	for _, tc := range []struct {
		method, path, origin, token string
		code                        int
	}{
		{"GET", "/status", "https://evil.example", a.cfg.Token, 403},
		{"POST", "/archive", "https://evil.example", a.cfg.Token, 403},
		{"GET", "/status", "https://papeledmaker.vercel.app", "wrong", 401},
		{"GET", "/status", "https://papeledmaker.vercel.app", a.cfg.Token, 200},
		{"OPTIONS", "/archive", "https://papeledmaker.vercel.app", "", 204},
		{"OPTIONS", "/archive", "https://evil.example", "", 403},
		{"POST", "/stop", "https://papeledmaker.vercel.app", a.cfg.Token, 403},
	} {
		w := call(a, tc.method, tc.path, tc.origin, tc.token, nil)
		if w.Code != tc.code {
			t.Errorf("%s %s: %d != %d", tc.method, tc.origin, w.Code, tc.code)
		}
	}
	r := httptest.NewRequest("GET", "http://malicious.example/status", nil)
	r.Header.Set("Authorization", "Bearer "+a.cfg.Token)
	w := httptest.NewRecorder()
	a.handler(w, r)
	if w.Code != 403 {
		t.Fatal("DNS rebinding host accepted")
	}
}
func TestRejectTraversalAndInvalidFiles(t *testing.T) {
	for _, number := range []string{"../escape", `..\escape`, "C:escape", "CON", "aux", "LPT1", "", "name.with.dot"} {
		a := testApp(t)
		if _, err := storeArchive(a.cfg.Root, payload(number, "Cliente")); err == nil {
			t.Fatalf("accepted %q", number)
		}
	}
	a := testApp(t)
	bad := payload("PM-001", "Cliente")
	bad.PDF = []byte("not PDF")
	if _, err := storeArchive(a.cfg.Root, bad); err == nil {
		t.Fatal("accepted invalid PDF")
	}
	bad = payload("PM-001", "Cliente")
	bad.Quote = json.RawMessage(`{"type":"papeled-estimate","quote":{"number":"other"}}`)
	if _, err := storeArchive(a.cfg.Root, bad); err == nil {
		t.Fatal("accepted wrong quote")
	}
}
func TestRootChangeAndPersistence(t *testing.T) {
	a := testApp(t)
	old := a.cfg.Root
	newRoot := filepath.Join(t.TempDir(), "nova pasta")
	body, _ := json.Marshal(map[string]string{"root": newRoot})
	w := call(a, "POST", "/settings", "https://papeledmaker.vercel.app", a.cfg.Token, body)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	reloaded, err := loadConfig(a.configPath, "unused")
	if err != nil || reloaded.Root != newRoot || reloaded.Token != a.cfg.Token {
		t.Fatal("config not persisted")
	}
	if _, err := storeArchive(a.cfg.Root, payload("PM-002", "Cliente")); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(old, "PM-002")); !os.IsNotExist(err) {
		t.Fatal("wrote to old root")
	}
	w = call(a, "POST", "/settings", "https://papeledmaker.vercel.app", a.cfg.Token, []byte(`{"root":"relative"}`))
	if w.Code != 400 {
		t.Fatal("accepted relative path")
	}
}
func TestSymlinkCannotRedirectArchive(t *testing.T) {
	a := testApp(t)
	outside := t.TempDir()
	os.MkdirAll(a.cfg.Root, 0700)
	if err := os.Symlink(outside, filepath.Join(a.cfg.Root, "PM-003")); err != nil {
		t.Skip("symlinks unavailable")
	}
	if _, err := storeArchive(a.cfg.Root, payload("PM-003", "Cliente")); err == nil {
		t.Fatal("accepted symlink")
	}
	files, _ := os.ReadDir(outside)
	if len(files) != 0 {
		t.Fatal("wrote outside destination")
	}
}
