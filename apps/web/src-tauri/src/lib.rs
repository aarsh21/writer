#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
  // TODO: test for other linux distros
    .on_page_load(|window, _payload| {
      let zoom_level = if cfg!(target_os = "linux") {
        1.4
      } else {
        1.0
      };
      if let Err(e) = window.set_zoom(zoom_level) {
        eprintln!("Failed to set zoom: {}", e);
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
