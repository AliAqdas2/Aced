import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./v1/auth";
import taxonomyRouter from "./v1/taxonomy";
import creatorsRouter from "./v1/creators";
import storefrontsRouter from "./v1/storefronts";
import listingsRouter from "./v1/listings";
import availabilityRouter from "./v1/availability";
import checkoutRouter from "./v1/checkout";
import libraryRouter from "./v1/library";
import reviewsRouter from "./v1/reviews";
import searchRouter from "./v1/search";
import adminRouter from "./v1/admin";
import notificationsRouter from "./v1/notifications";
import creatorDashboardRouter from "./v1/creator-dashboard";
import profileRouter from "./v1/profile";
import calendarRouter from "./v1/calendar";

const router: IRouter = Router();

// Health check
router.use(healthRouter);

// Versioned API routes
const v1 = Router();

v1.use(authRouter);
v1.use(taxonomyRouter);
v1.use(creatorsRouter);
v1.use(storefrontsRouter);
v1.use(listingsRouter);
v1.use(availabilityRouter);
v1.use(checkoutRouter);
v1.use(libraryRouter);
v1.use(reviewsRouter);
v1.use(searchRouter);
v1.use(adminRouter);
v1.use(notificationsRouter);
v1.use(creatorDashboardRouter);
v1.use(profileRouter);
v1.use(calendarRouter);

router.use("/v1", v1);

export default router;
