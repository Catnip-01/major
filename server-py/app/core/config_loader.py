import yaml
from pathlib import Path

class ConfigLoader:
    def __init__(self):
        self.config_dir = Path(__file__).parent.parent / "config"
        
    def load_yaml(self, filename: str):
        with open(self.config_dir / filename, 'r') as f:
            return yaml.safe_load(f)

    def get_prompt(self, section: str, key: str):
        prompts = self.load_yaml("prompts.yaml")
        return prompts.get(section, {}).get(key)

    def get_query(self, key: str):
        queries = self.load_yaml("queries.yaml")
        return queries.get(key)

config_loader = ConfigLoader()
