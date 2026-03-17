import { NextRequest } from "next/server"
import { POST as handleActionPost } from "../[action]/route"

export async function POST(req: NextRequest) {
  return handleActionPost(req, {
    params: Promise.resolve({ action: "login" }),
  })
}
