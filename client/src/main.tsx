import {installMutationNotifications} from './lib/mutation-notifications';
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./components/refinement.css";
import "./components/polish.css";
import "./components/dashboard-update.css";
import "./lib/i18n";

installMutationNotifications();

createRoot(document.getElementById("root")!).render(<App />);
