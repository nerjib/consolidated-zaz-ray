# Exporting Data from Heroku Postgres to Local Postgres

Here are the steps to export your data from a Heroku Postgres database and import it into your local PostgreSQL instance.

### Step 1: Log in to Heroku

Use the Heroku CLI to log in to your account. The `-i` flag will allow you to log in interactively in the terminal.

```bash
heroku login -i
```

### Step 2: Capture a backup of your Heroku Postgres database

Use the Heroku CLI to create a new backup of your remote database.

```bash
heroku pg:backups:capture
```

### Step 3: Download the backup file

Download the backup created in the previous step. This will download a file named `latest.dump` to your current directory.

```bash
heroku pg:backups:download
```

### Step 4: Create a new local database

Create a new database on your local PostgreSQL server where you will import the data.

```bash
createdb <your_new_database_name>
```

Replace `<your_new_database_name>` with the name you want for your local database.

### Step 5: Import the backup into your local database

Use the `pg_restore` command to import the data from the `latest.dump` file into your newly created local database.

```bash
pg_restore --verbose --no-acl --no-owner -h localhost -U <your_username> -d <your_new_database_name> latest.dump
```

Replace `<your_username>` with your local PostgreSQL username and `<your_new_database_name>` with the name of the database you created in the previous step.

**Note on the `--clean` flag:**

If you are restoring into an existing database that already has data, you can add the `--clean` flag to drop existing database objects before creating them. For a new, empty database, the `--clean` flag is not necessary and will produce non-fatal errors.

After these steps, your Heroku database will be successfully imported into your local PostgreSQL environment.