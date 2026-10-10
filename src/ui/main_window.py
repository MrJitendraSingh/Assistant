from pathlib import Path
from PySide6.QtCore import QUrl
from PySide6.QtWebChannel import QWebChannel
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWidgets import QMainWindow
from src.bridge.channel import BridgeChannel
from src.database.settings import SettingsRepository 

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Offline Gemini Desktop")
        self.resize(1200, 800)

        self.web_view = QWebEngineView()
        self.setCentralWidget(self.web_view)

        # Connect IPC
        self.channel = QWebChannel()
        self.bridge = BridgeChannel(self.web_view)
        SettingsRepository.initialize()
        self.channel.registerObject("bridge", self.bridge)
        self.web_view.page().setWebChannel(self.channel)

        # Load local HTML file
        index_file = Path(__file__).resolve().parent.parent.parent / "frontend" / "index.html"
        self.web_view.setUrl(QUrl.fromLocalFile(str(index_file)))



if __name__ == "__main__":
    import os
    import sys
    # ENABLE DEVTOOLS: MUST be set before QApplication is created
    os.environ["QTWEBENGINE_REMOTE_DEBUGGING"] = "9222"
    from PySide6.QtWidgets import QApplication

    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())