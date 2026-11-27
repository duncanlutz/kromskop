/// Starts the desktop shell. The window itself is declared in `tauri.conf.json`.
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("failed to start Kromskop");
}
