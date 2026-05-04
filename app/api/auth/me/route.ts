import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/get-session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(null, { status: 401 });
  }
  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
  });
}
