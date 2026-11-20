import { respond } from "@/lib/api";
import { listProfiles } from "@/lib/lessons";

export const GET = () => respond(listProfiles);
