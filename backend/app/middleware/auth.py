from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from supabase import create_client
import os

PUBLIC_PATHS = {"/", "/health", "/docs", "/openapi.json", "/redoc"}
PUBLIC_PREFIXES = ("/webhook/", "/agent/", "/widget/")

def get_supabase():
    return create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        if request.method == "OPTIONS" or path in PUBLIC_PATHS or path.startswith(PUBLIC_PREFIXES):
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(status_code=401, content={"detail": "Missing auth token"})

        access_token = auth_header.removeprefix("Bearer ").strip()

        try:
            client = get_supabase()
            response = client.auth.get_user(access_token)
            user = response.user
            if not user:
                return JSONResponse(status_code=401, content={"detail": "Invalid token"})
            request.state.user_id = user.id
            request.state.email = user.email or ""
        except Exception as e:
            print(f"AUTH ERROR: {e}")
            return JSONResponse(status_code=401, content={"detail": f"Auth failed: {str(e)}"})

        return await call_next(request)