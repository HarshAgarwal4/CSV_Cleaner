import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))


def __getattr__(name: str):
    import AI.agent as agent
    if hasattr(agent, name):
        return getattr(agent, name)
    raise AttributeError(f"module 'AI' has no attribute '{name}'")


__all__ = ["graph", "State", "Rule", "ColumnRule", "llm", "rule_llm"]
