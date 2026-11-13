// Fronteira Morta — executável para Windows.
//
// Abre o jogo numa janela própria (WebView2, que já vem no Windows 10 e 11),
// sem navegador. Os arquivos do jogo ficam embutidos no .exe e são servidos
// só para a própria máquina (127.0.0.1). O progresso é gravado em
// %LOCALAPPDATA%\FronteiraMorta\save.json, sempre por cima do save antigo.
package main

import (
	"embed"
	"encoding/json"
	"io/fs"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"syscall"
	"unsafe"

	webview2 "github.com/jchv/go-webview2"
)

//go:embed all:game
var gameFiles embed.FS

func dataDir() string {
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		base, _ = os.UserConfigDir()
	}
	dir := filepath.Join(base, "FronteiraMorta")
	_ = os.MkdirAll(dir, 0o755)
	return dir
}

// grava o save por cima do antigo (escreve num arquivo temporário e troca,
// para o save nunca ficar pela metade se o PC desligar no meio)
func writeSave(dir, data string) error {
	final := filepath.Join(dir, "save.json")
	tmp := final + ".tmp"
	if err := os.WriteFile(tmp, []byte(data), 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, final)
}

func messageBox(title, text string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	box := user32.NewProc("MessageBoxW")
	t, _ := syscall.UTF16PtrFromString(title)
	m, _ := syscall.UTF16PtrFromString(text)
	box.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), 0x10)
}

func main() {
	dir := dataDir()

	// servidor local só para esta máquina, numa porta livre
	sub, _ := fs.Sub(gameFiles, "game")
	files := http.FileServer(http.FS(sub))
	mux := http.NewServeMux()
	mux.HandleFunc("/__ping", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNoContent) })
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		files.ServeHTTP(w, r)
	})
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		messageBox("Fronteira Morta", "Não foi possível iniciar o jogo: "+err.Error())
		return
	}
	go http.Serve(ln, mux)

	w := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug:     false,
		AutoFocus: true,
		DataPath:  filepath.Join(dir, "webview"),
		WindowOptions: webview2.WindowOptions{
			Title:  "Fronteira Morta",
			Width:  1280,
			Height: 860,
			IconId: 1,
			Center: true,
		},
	})
	if w == nil {
		messageBox("Fronteira Morta",
			"Este jogo precisa do Microsoft Edge WebView2 Runtime.\n\n"+
				"Ele já vem no Windows 10 e 11 atualizados. Se faltar, instale o "+
				"\"WebView2 Runtime\" pelo site da Microsoft e abra o jogo de novo.")
		return
	}
	defer w.Destroy()

	// entrega o save atual para o jogo antes da página carregar
	saved := "null"
	if b, err := os.ReadFile(filepath.Join(dir, "save.json")); err == nil && json.Valid(b) {
		s, _ := json.Marshal(string(b))
		saved = string(s)
	}
	w.Init("window.__FM_NATIVE__ = true; window.__FM_SAVE__ = " + saved + ";")

	// o jogo chama fmSave(texto) em cada checkpoint
	_ = w.Bind("fmSave", func(data string) error {
		if !json.Valid([]byte(data)) {
			return nil
		}
		return writeSave(dir, data)
	})

	// "Salvar e sair" no menu de pausa: fecha a janela depois de gravar
	_ = w.Bind("fmQuit", func() {
		w.Dispatch(func() { w.Terminate() })
	})

	w.Navigate("http://" + ln.Addr().String() + "/index.html")
	w.Run()
}
