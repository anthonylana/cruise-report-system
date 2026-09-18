from fastapi import FastAPI


app = FastAPI(title="Cruise Report System API")


@app.get("/")
def read_root():
    return {"status": "ok", "message": "Cruise Report System API is running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
