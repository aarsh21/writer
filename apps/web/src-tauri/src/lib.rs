use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Platform-specific window configuration
            if let Some(window) = app.get_webview_window("main") {
                #[cfg(target_os = "macos")]
                {
                    use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

                    // Apply vibrancy effect for macOS - gives a polished native feel
                    if let Err(e) =
                        apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(12.0))
                    {
                        log::warn!("Failed to apply vibrancy: {}", e);
                    }
                }

                #[cfg(target_os = "windows")]
                {
                    // Keep decorations enabled on Windows for native title bar controls
                    let _ = window.set_decorations(true);
                }

                #[cfg(target_os = "linux")]
                {
                    // Disable decorations on Linux for custom title bar
                    let _ = window.set_decorations(false);

                    // Adjust zoom for better readability on Linux in debug mode
                    if cfg!(debug_assertions) {
                        let _ = window.set_zoom(1.3);
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
