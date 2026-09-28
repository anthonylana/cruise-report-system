"""Last-resort error handling for unexpected exceptions.

Why a middleware and not @app.exception_handler(Exception)?
Starlette runs Exception/500 handlers inside ServerErrorMiddleware, which sits
OUTSIDE CORSMiddleware. Responses produced there have no CORS headers, so the
browser hides them and the UI shows a misleading "network error".

This middleware must be added BEFORE CORSMiddleware in main.py (the last
middleware added is the outermost), so our 500 passes through CORS on the way out.
"""

import logging
from uuid import uuid4

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("api.errors")


def new_ref_id() -> str:
    """Short random ID shown to the user and logged next to the traceback."""
    return uuid4().hex[:8]


class UnhandledErrorMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":  # websockets / lifespan: not our business
            await self.app(scope, receive, send)
            return

        response_started = False

        async def send_wrapper(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            ref = new_ref_id()
            logger.exception(
                "Unhandled error (ref: %s) on %s %s", ref, scope["method"], scope["path"]
            )
            if response_started:
                # Headers already sent: we can't replace the response. Let the server abort it.
                raise
            response = JSONResponse(
                status_code=500,
                content={"detail": f"Internal server error (ref: {ref})"},
            )
            await response(scope, receive, send)