import { runMigrations } from '@mastra/engine';
import { execa, ExecaError } from 'execa';
import yoctoSpinner from 'yocto-spinner';

import { getEnginePath } from '../utils.js';

const spinner = yoctoSpinner({ text: 'Migrating Database\n' });

export async function migrate(dbUrl: string) {
  spinner.start();
  try {
    await checkPostgresReady(dbUrl);
    spinner.success('Migration complete! Your project is ready to go.');
    process.exit(0);
  } catch (error: any) {
    spinner.error('Could not migrate database');
    if (error instanceof ExecaError) {
      console.error('error');
    } else {
      console.log(`Error: ${error.message}`);
    }

    process.exit(1);
  }
}

interface MigrationResult {
  stdout: string;
  stderr: string;
}

export async function _migrate(dbUrl: string, swallow: boolean = false): Promise<MigrationResult> {
  const enginePath = getEnginePath();
  // const migrateScript = require(path.join(enginePath, 'dist/postgres/migrate.js'));

  const stdioMode = swallow ? 'pipe' : 'inherit';
  const subprocess = execa(`pnpx tsx ./dist/postgres/migrate.js`, {
    env: {
      ...process.env,
      DB_URL: dbUrl,
    },
    cwd: enginePath,
    shell: true,
    all: true,
    stdio: ['pipe', stdioMode, stdioMode],
    timeout: 60000,
  });

  if (subprocess.stdin) {
    subprocess.on('spawn', () => {
      const responses = ['y\n', 'yes\n'];
      const respondToPrompts = setInterval(() => {
        if (subprocess.stdin && !subprocess.stdin.destroyed) {
          responses.forEach(response => {
            subprocess.stdin.write(response);
          });
        }
      }, 100);

      subprocess.on('exit', () => {
        clearInterval(respondToPrompts);
        subprocess.stdin?.end();
      });
    });
  }

  try {
    const { stdout, stderr } = await subprocess;
    return { stdout: stdout || '', stderr: stderr || '' };
  } catch (error: any) {
    if (error.killed && error.timedOut) {
      throw new Error(`Command timed out after 60000ms`);
    }
    throw error;
  }
}

async function checkPostgresReady(dbUrl: string) {
  for (let i = 0; i < 10; i++) {
    try {
      await runMigrations(dbUrl); // attempts to create the migration w/o applying it
      return true;
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      }

      console.log(`Waiting for postgres to be ready, attempt ${i + 1} of 10`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Postgres is not ready, aborting');
}
