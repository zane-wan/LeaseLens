import { NextRequest } from "next/server"
import { GET as handleActionGet } from "../[action]/route"

export async function GET(req: NextRequest) {
  return handleActionGet(req, {
    params: Promise.resolve({ action: "me" }),
  })
}
