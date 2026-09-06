import time
from typing import Dict, Any

# Standard unit costs (as of 2024-2026 pricing benchmarks)
RATES = {
    "whisper_audio_per_minute": 0.006,  # OpenAI Whisper API benchmark ($0.006 / min)
    "gpt4o_mini_input_per_m": 0.150,     # $0.15 per 1,000,000 input tokens
    "gpt4o_mini_output_per_m": 0.600,    # $0.60 per 1,000,000 output tokens
    "local_compute_per_minute": 0.001,   # Estimated CPU/GPU local energy cost
}

class CostTracker:
    def __init__(self):
        self.ledger = {
            "video_transcriber": {"audio_seconds": 0.0, "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0, "runs": 0},
            "media_clipper": {"processed_seconds": 0.0, "cost_usd": 0.0, "runs": 0},
            "audiobook_transcriber": {"audio_seconds": 0.0, "cost_usd": 0.0, "runs": 0},
            "audio_extractor": {"audio_seconds": 0.0, "cost_usd": 0.0, "runs": 0},
        }
        self.budget_limit = 10.00 # Default budget $10.00

    def record_transcription(self, module: str, duration_sec: float, input_tokens: int = 0, output_tokens: int = 0):
        duration_min = duration_sec / 60.0
        whisper_cost = duration_min * RATES["whisper_audio_per_minute"]
        llm_cost = (input_tokens / 1_000_000 * RATES["gpt4o_mini_input_per_m"]) + \
                   (output_tokens / 1_000_000 * RATES["gpt4o_mini_output_per_m"])
        total_op_cost = whisper_cost + llm_cost

        if module in self.ledger:
            self.ledger[module]["audio_seconds"] += duration_sec
            self.ledger[module]["cost_usd"] += total_op_cost
            self.ledger[module]["runs"] += 1
            if "input_tokens" in self.ledger[module]:
                self.ledger[module]["input_tokens"] += input_tokens
                self.ledger[module]["output_tokens"] += output_tokens
        return total_op_cost

    def record_media_clipping(self, module: str, duration_sec: float):
        compute_cost = (duration_sec / 60.0) * RATES["local_compute_per_minute"]
        if module in self.ledger:
            self.ledger[module]["processed_seconds"] += duration_sec
            self.ledger[module]["cost_usd"] += compute_cost
            self.ledger[module]["runs"] += 1
        return compute_cost

    def get_total_cost(self) -> float:
        return sum(item["cost_usd"] for item in self.ledger.values())

    def get_budget_percentage(self) -> float:
        if self.budget_limit <= 0:
            return 0.0
        return min(100.0, (self.get_total_cost() / self.budget_limit) * 100.0)
