from langchain_groq import ChatGroq
from app.core.config import GROQ_API_KEY, GROQ_MODEL

_llm = None

def get_llm(temperature: float = 0.2):
    global _llm
    if _llm is None:
        _llm = ChatGroq(api_key=GROQ_API_KEY, model=GROQ_MODEL, temperature=temperature)
    return _llm
