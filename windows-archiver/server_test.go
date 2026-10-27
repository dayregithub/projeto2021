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
		{"GET", "/status", "https://maker.papeled.com.br", a.cfg.Token, 200},
		{"OPTIONS", "/archive", "https://maker.papeled.com.br", "", 204},
		{"GET", "/status", "https://maker.papeled.com.br.evil.example", a.cfg.Token, 403},
		{"GET", "/status", "http://maker.papeled.com.br", a.cfg.Token, 403},
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

func TestOpenFolderPreservesOriginalDestinationAndFiles(t *testing.T) {
	a := testApp(t)
	var opened string
	a.openFolder = func(path string) error { opened = path; return nil }
	data, _ := json.Marshal(payload("PM-20261022-OPEN01", "Cliente"))
	w := call(a, "POST", "/archive", "https://papeledmaker.vercel.app", a.cfg.Token, data)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	original := filepath.Join(a.cfg.Root, "PM-20261022-OPEN01")
	custom := filepath.Join(original, "meu-projeto.txt")
	os.WriteFile(custom, []byte("arquivo extra"), 0600)
	newRoot := filepath.Join(t.TempDir(), "novos")
	body, _ := json.Marshal(map[string]string{"root": newRoot})
	if w = call(a, "POST", "/settings", "https://papeledmaker.vercel.app", a.cfg.Token, body); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	// A fresh process still finds the old path after changing the default root.
	reloaded, err := loadConfig(a.configPath, "unused")
	if err != nil {
		t.Fatal(err)
	}
	a.cfg = reloaded
	w = call(a, "POST", "/open-folder", "https://papeledmaker.vercel.app", a.cfg.Token, []byte(`{"number":"PM-20261022-OPEN01"}`))
	if w.Code != 200 || opened != original {
		t.Fatalf("opened %q, response %d %s", opened, w.Code, w.Body.String())
	}
	if content, err := os.ReadFile(custom); err != nil || string(content) != "arquivo extra" {
		t.Fatal("Opening changed extra files")
	}
}
func TestOpenFolderDoesNotCreateMissingFoldersOrAcceptPaths(t *testing.T) {
	a := testApp(t)
	calls := 0
	a.openFolder = func(path string) error { calls++; return nil }
	for _, number := range []string{"PM-NOT-ARCHIVED", "../escape", `C:\\Users\\Maker`, "CON"} {
		data, _ := json.Marshal(map[string]string{"number": number})
		w := call(a, "POST", "/open-folder", "https://papeledmaker.vercel.app", a.cfg.Token, data)
		if w.Code == 200 {
			t.Fatalf("opened %s", number)
		}
	}
	if calls != 0 {
		t.Fatal("Launched explorer for invalid or missing folder")
	}
	if _, err := os.Stat(filepath.Join(a.cfg.Root, "PM-NOT-ARCHIVED")); !os.IsNotExist(err) {
		t.Fatal("Created missing folder")
	}
	// Backward compatibility: folders archived by the initial application have no index.
	path := filepath.Join(a.cfg.Root, "PM-LEGACY")
	os.MkdirAll(path, 0700)
	w := call(a, "POST", "/open-folder", "https://papeledmaker.vercel.app", a.cfg.Token, []byte(`{"number":"PM-LEGACY"}`))
	if w.Code != 200 || calls != 1 {
		t.Fatal(w.Body.String())
	}
}

func TestCancelledThenDeletedFolderKeepsNumberAndContents(t *testing.T) {
	a := testApp(t)
	number := "PM-20261022-8A0699"
	data, _ := json.Marshal(payload(number, "Cliente"))
	if w := call(a, "POST", "/archive", "https://papeledmaker.vercel.app", a.cfg.Token, data); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	original := filepath.Join(a.cfg.Root, number)
	os.WriteFile(filepath.Join(original, "extra.txt"), []byte("preservado"), 0600)
	for _, state := range []string{"cancelled", "cancelled", "deleted", "deleted"} {
		body, _ := json.Marshal(map[string]string{"number": number, "state": state})
		w := call(a, "POST", "/folder-state", "https://papeledmaker.vercel.app", a.cfg.Token, body)
		if w.Code != 200 {
			t.Fatal(w.Body.String())
		}
		suffix := " - CANCELADO"
		if state == "deleted" {
			suffix = " - DELETADO"
		}
		path := filepath.Join(a.cfg.Root, number+suffix)
		if b, err := os.ReadFile(filepath.Join(path, "extra.txt")); err != nil || string(b) != "preservado" {
			t.Fatal("extra file changed", err)
		}
		for _, name := range []string{"orcamento-" + number + ".pdf", "orcamento-editavel.json"} {
			if _, err := os.Stat(filepath.Join(path, name)); err != nil {
				t.Fatal(err)
			}
		}
		if resolved, err := a.resolveArchive(number); err != nil || resolved != path {
			t.Fatal("index not updated", resolved, err)
		}
	}
	if _, err := os.Stat(original); !os.IsNotExist(err) {
		t.Fatal("old folder still exists")
	}
	if _, err := a.renameArchive(number, "cancelled"); err == nil {
		t.Fatal("downgraded deleted folder")
	}
}
func TestRenameConflictAndMissingFolderNeverReplaceAnything(t *testing.T) {
	a := testApp(t)
	number := "PM-CONFLICT"
	path, err := storeArchive(a.cfg.Root, payload(number, "Cliente"))
	if err != nil {
		t.Fatal(err)
	}
	a.rememberArchive(number, path)
	destination := path + " - CANCELADO"
	os.MkdirAll(destination, 0700)
	os.WriteFile(filepath.Join(destination, "keep.txt"), []byte("destino"), 0600)
	if _, err := a.renameArchive(number, "cancelled"); err == nil {
		t.Fatal("replaced existing destination")
	}
	if b, err := os.ReadFile(filepath.Join(destination, "keep.txt")); err != nil || string(b) != "destino" {
		t.Fatal("destination changed")
	}
	if _, err := os.Stat(filepath.Join(path, "orcamento-editavel.json")); err != nil {
		t.Fatal("source lost")
	}
	w := call(a, "POST", "/folder-state", "https://papeledmaker.vercel.app", a.cfg.Token, []byte(`{"number":"PM-MISSING","state":"deleted"}`))
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"skipped":true`) {
		t.Fatal(w.Body.String())
	}
	if _, err := os.Stat(filepath.Join(a.cfg.Root, "PM-MISSING - DELETADO")); !os.IsNotExist(err) {
		t.Fatal("created missing folder")
	}
	if _, err := a.renameArchive("../escape", "deleted"); err == nil {
		t.Fatal("accepted traversal")
	}
}
func TestRearchiveCancelledFolderDoesNotCreateDuplicate(t *testing.T) {
	a := testApp(t)
	number := "PM-REARCHIVE"
	data, _ := json.Marshal(payload(number, "Cliente"))
	call(a, "POST", "/archive", "https://papeledmaker.vercel.app", a.cfg.Token, data)
	path, err := a.renameArchive(number, "cancelled")
	if err != nil {
		t.Fatal(err)
	}
	data, _ = json.Marshal(payload(number, "Atualizado"))
	w := call(a, "POST", "/archive", "https://papeledmaker.vercel.app", a.cfg.Token, data)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if b, err := os.ReadFile(filepath.Join(path, "orcamento-editavel.json")); err != nil || !strings.Contains(string(b), "Atualizado") {
		t.Fatal("quote not updated")
	}
	if _, err := os.Stat(filepath.Join(a.cfg.Root, number)); !os.IsNotExist(err) {
		t.Fatal("created duplicate unsuffixed folder")
	}
}
