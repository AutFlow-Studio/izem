import { Router, type IRouter } from "express";
import { requireAuth } from "../middleware/auth";
import healthRouter from "./health";
import authRouter from "./auth";
import storageRouter from "./storage";
import settingsApiRouter from "./settings-api";
import clientsRouter from "./clients";
import projectsRouter from "./projects";
import deliverablesRouter from "./deliverables";
import paymentsRouter from "./payments";
import documentsRouter from "./documents";
import notesRouter from "./notes";
import meetingsRouter from "./meetings";
import tasksRouter from "./tasks";
import timelineRouter from "./timeline";
import activityRouter from "./activity";
import calendarRouter from "./calendar";
import searchRouter from "./search";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import adminRouter from "./admin";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

// ── Public routes (no authentication required) ───────────────────────────────
router.use(healthRouter);
router.use(authRouter);   // /auth/login, /auth/logout, /auth/me (me checks internally)

// ── Auth gate ────────────────────────────────────────────────────────────────
// All routes mounted below this line require a valid session.
router.use(requireAuth);

// ── Protected routes ──────────────────────────────────────────────────────────
router.use(storageRouter);
router.use(settingsApiRouter);
router.use(dashboardRouter);
router.use(clientsRouter);
router.use(projectsRouter);
router.use(deliverablesRouter);
router.use(paymentsRouter);
router.use(documentsRouter);
router.use(notesRouter);
router.use(meetingsRouter);
router.use(tasksRouter);
router.use(timelineRouter);
router.use(activityRouter);
router.use(calendarRouter);
router.use(searchRouter);
router.use(reportsRouter);
router.use(adminRouter);
router.use(notificationsRouter);

export default router;
