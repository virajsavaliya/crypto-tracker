# File: core/management/commands/start_all.py

import os
import subprocess
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = 'Starts all services using honcho and a Procfile.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('Starting all services with honcho...'))
        
        # This should point to your 'backend' directory where the Procfile is located.
        # It assumes your management commands are in 'backend/core/management/commands'.
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

        try:
            # Command to run honcho from the project's root directory.
            # It will automatically find and use the 'Procfile'.
            subprocess.run(['honcho', 'start'], check=True, cwd=project_root)
        
        except FileNotFoundError:
            self.stdout.write(self.style.ERROR(
                "Error: 'honcho' command not found.\n"
                "Please install it by running: pip install honcho"
            ))
        except subprocess.CalledProcessError as e:
            self.stdout.write(self.style.ERROR(f"An error occurred while running honcho: {e}"))
        except KeyboardInterrupt:
            self.stdout.write(self.style.SUCCESS('\nServices stopped by user.'))