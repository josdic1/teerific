import type {
  CurrentUser
} from "@teerific/shared";

declare global {
  namespace Express {
    interface Request {
      currentUser?: CurrentUser;
    }
  }
}

export {};
