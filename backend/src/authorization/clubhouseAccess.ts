import {
  canUserViewPrimary
} from "../repositories/clubhouseRepository.js";

export async function canViewGolfer(
  viewerUserId: string,
  golferUserId: string
): Promise<boolean> {
  return canUserViewPrimary(
    viewerUserId,
    golferUserId
  );
}
