-- =====================================================================
-- Fitness app - MySQL schema (FINAL, fresh build)
-- Works on MySQL 8.0.16+ (CHECK constraints are enforced from 8.0.16).
-- Plan templates, the exercise pool and each generated plan live in
-- MongoDB. This file holds accounts, profiles, goals, plan pointers
-- and all daily / workout / weekly logs.
--
-- Rebuild from zero:  npm run setup-db:reset
-- =====================================================================

CREATE DATABASE IF NOT EXISTS fitness_app
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE fitness_app;

-- ---------------------------------------------------------------------
-- goals: the 11 selectable goals, each belongs to one of 9 goal types.
-- goal_type + body-composition category  ->  one of the 36 plan templates.
-- ---------------------------------------------------------------------
CREATE TABLE goals (
  id        CHAR(3)      NOT NULL,
  goal_type ENUM('Fat Loss','Muscle','Body Transformation','Endurance',
                 'Posture','Flexibility','Health','Habits','Mobility') NOT NULL,
  name      VARCHAR(120) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

INSERT INTO goals (id, goal_type, name) VALUES
  ('G01','Fat Loss','Lose over all fat'),
  ('G02','Muscle','Bulking'),
  ('G03','Muscle','Get shredded / lean look'),
  ('G04','Muscle','Get stronger'),
  ('G05','Body Transformation','Full body transformation'),
  ('G06','Endurance','Improve stamina / endurance'),
  ('G07','Posture','Fix posture / relieve back pain'),
  ('G08','Flexibility','Do the splits / be flexible'),
  ('G09','Health','More energy / feel better / better sleep / less stress'),
  ('G10','Habits','Build a daily exercise habit'),
  ('G11','Mobility','More mobility and better movement');

-- ---------------------------------------------------------------------
-- persons: the profile.
-- Registration happens BEFORE the first test, so every test field is
-- NULL until the person takes the test.
-- bmi, bmi_group and category are GENERATED (never write to them) and
-- stay NULL until all the inputs they need are filled in.
-- ---------------------------------------------------------------------
CREATE TABLE persons (
  id                         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  full_name                  VARCHAR(100)  NOT NULL,
  birth_date                 DATE          NULL,

  height_cm                  DECIMAL(4,1)  NULL,
  weight_kg                  DECIMAL(5,1)  NULL,

  -- "activity history", split into the 3 inputs the category rules use
  job_type        ENUM('Sedentary','Light Movement','Active','Heavy Physical') NULL,
  weight_training ENUM('Low','Moderate','High') NULL,
  cardio_history  ENUM('Low','Moderate','High') NULL,

  availability_hours_per_day DECIMAL(3,1)  NULL,
  health_issue_count         TINYINT UNSIGNED NULL,

  -- derived (do not write to these)
  bmi DECIMAL(4,1) GENERATED ALWAYS AS
      (ROUND(weight_kg / POW(height_cm / 100, 2), 1)) STORED,
  bmi_group ENUM('Low','Moderate','High') GENERATED ALWAYS AS
      (CASE WHEN bmi IS NULL  THEN NULL
            WHEN bmi < 18.5   THEN 'Low'
            WHEN bmi < 25.0   THEN 'Moderate'
            ELSE 'High' END) STORED,
  category ENUM('Muscular','Normal','Skinny Fat','Fat') GENERATED ALWAYS AS
      (CASE
         WHEN bmi_group IS NULL OR weight_training IS NULL
              OR job_type IS NULL OR cardio_history IS NULL THEN NULL
         WHEN weight_training = 'High' THEN 'Muscular'
         WHEN weight_training = 'Moderate'
              OR job_type IN ('Active','Heavy Physical')
           THEN CASE WHEN bmi_group = 'Low' THEN 'Muscular' ELSE 'Normal' END
         WHEN bmi_group = 'High'     THEN 'Fat'
         WHEN bmi_group = 'Moderate' THEN 'Skinny Fat'
         WHEN cardio_history = 'Low' THEN 'Normal'
         ELSE 'Skinny Fat'
       END) STORED,

  goal_id                    CHAR(3)       NULL,

  -- same short ids the frontend uses (validated by the API)
  avatar_shape               VARCHAR(30)   NOT NULL DEFAULT 'classic',
  avatar_color               VARCHAR(30)   NOT NULL DEFAULT 'sage',

  -- IANA name, e.g. 'Africa/Algiers'. Used for every "today" check.
  timezone                   VARCHAR(64)   NOT NULL DEFAULT 'UTC',

  created_at                 TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                 TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                           ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT fk_person_goal FOREIGN KEY (goal_id) REFERENCES goals (id),
  -- CHECKs pass when the value is NULL, so they are safe before the test
  CONSTRAINT chk_height       CHECK (height_cm BETWEEN 100 AND 250),
  CONSTRAINT chk_weight       CHECK (weight_kg BETWEEN 25 AND 400),
  CONSTRAINT chk_availability CHECK (availability_hours_per_day > 0
                                     AND availability_hours_per_day <= 24),
  CONSTRAINT chk_health       CHECK (health_issue_count BETWEEN 0 AND 5),
  INDEX idx_person_category_goal (category, goal_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- users: login only (1 user : 1 person).
-- password_hash = bcrypt output. NEVER store the plain password.
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(50)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  person_id     INT UNSIGNED NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_username (username),
  UNIQUE KEY uq_user_person (person_id),
  CONSTRAINT fk_user_person FOREIGN KEY (person_id)
    REFERENCES persons (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- refresh_tokens: only a HASH (sha-256 hex) of each refresh token is
-- stored. Rotation: the old row gets revoked_at, a new row is inserted.
-- Datetimes are stored in UTC.
-- ---------------------------------------------------------------------
CREATE TABLE refresh_tokens (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED    NOT NULL,
  token_hash  CHAR(64)        NOT NULL,
  expires_at  DATETIME        NOT NULL,
  revoked_at  DATETIME        NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_token_hash (token_hash),
  INDEX idx_refresh_user (user_id),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- user_plans: pointer to the generated plan stored in MongoDB, its dates
-- and a snapshot of the inputs used. Plans are never regenerated.
--   ends_at is EXCLUSIVE (first day the plan no longer applies);
--   NULL = lifelong plan.
--   ONE active plan per person is enforced by the unique index on the
--   generated column active_person_id (= person_id while 'active',
--   NULL otherwise; NULLs do not collide in a unique index).
--
-- NOTE: MySQL does not allow ON DELETE CASCADE on a column that feeds a
-- STORED generated column, so person_id here uses the default RESTRICT.
-- To delete a person, delete their user_plans rows first (that cascades
-- to their workout logs), then the person.
-- ---------------------------------------------------------------------
CREATE TABLE user_plans (
  id                         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  person_id                  INT UNSIGNED  NOT NULL,
  template_plan_id           VARCHAR(64)   NOT NULL,  -- e.g. fat_loss__skinny_fat
  mongo_plan_id              VARCHAR(64)   NOT NULL,  -- _id of the generated plan document
  goal_id                    CHAR(3)       NOT NULL,
  category                   ENUM('Muscular','Normal','Skinny Fat','Fat') NOT NULL,

  -- snapshot of the inputs used at the test
  age_at_start               TINYINT UNSIGNED NOT NULL,
  height_cm                  DECIMAL(4,1)  NOT NULL,
  weight_kg                  DECIMAL(5,1)  NOT NULL,
  availability_hours_per_day DECIMAL(3,1)  NOT NULL,
  health_issue_count         TINYINT UNSIGNED NOT NULL,

  started_at                 DATE          NOT NULL,
  ends_at                    DATE          NULL,
  status                     ENUM('active','completed') NOT NULL DEFAULT 'active',
  created_at                 TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  active_person_id INT UNSIGNED GENERATED ALWAYS AS
      (CASE WHEN status = 'active' THEN person_id ELSE NULL END) STORED,

  PRIMARY KEY (id),
  UNIQUE KEY uq_one_active_plan (active_person_id),
  UNIQUE KEY uq_mongo_plan (mongo_plan_id),
  INDEX idx_user_plans_person (person_id, status),
  CONSTRAINT fk_plan_person FOREIGN KEY (person_id) REFERENCES persons (id),
  CONSTRAINT fk_plan_goal   FOREIGN KEY (goal_id)   REFERENCES goals (id),
  CONSTRAINT chk_plan_dates CHECK (ends_at IS NULL OR ends_at > started_at),
  CONSTRAINT chk_plan_health CHECK (health_issue_count BETWEEN 0 AND 5)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- daily_logs: water and sleep, one row per person per day.
-- Values are absolute, last write wins. Only today's date is accepted
-- by the API (checked in the user's timezone).
-- ---------------------------------------------------------------------
CREATE TABLE daily_logs (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  person_id   INT UNSIGNED  NOT NULL,
  log_date    DATE          NOT NULL,
  water_ml    INT UNSIGNED  NULL,
  sleep_hours DECIMAL(3,1)  NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                            ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_daily_person_date (person_id, log_date),
  CONSTRAINT fk_daily_person FOREIGN KEY (person_id)
    REFERENCES persons (id) ON DELETE CASCADE,
  CONSTRAINT chk_sleep CHECK (sleep_hours BETWEEN 0 AND 24),
  CONSTRAINT chk_water CHECK (water_ml <= 10000)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- workout_logs: one row per person per trained day.
-- exercises_total = every exercise planned that day (all types).
-- Streaks are NEVER stored; they are computed from the plan + these rows.
-- ---------------------------------------------------------------------
CREATE TABLE workout_logs (
  id              INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  person_id       INT UNSIGNED      NOT NULL,
  user_plan_id    INT UNSIGNED      NOT NULL,
  log_date        DATE              NOT NULL,
  day_number      TINYINT UNSIGNED  NOT NULL,
  exercises_done  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  exercises_total SMALLINT UNSIGNED NOT NULL,
  created_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP
                                    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_workout_person_date (person_id, log_date),
  INDEX idx_workout_plan_date (user_plan_id, log_date),
  CONSTRAINT fk_workout_person FOREIGN KEY (person_id)
    REFERENCES persons (id) ON DELETE CASCADE,
  CONSTRAINT fk_workout_plan FOREIGN KEY (user_plan_id)
    REFERENCES user_plans (id) ON DELETE CASCADE,
  CONSTRAINT chk_workout_counts CHECK (exercises_done <= exercises_total)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- workout_log_exercises: the ids of the checked-off exercises.
-- exercise_id = the exercise _id in MongoDB (longest today: 53 chars).
-- ---------------------------------------------------------------------
CREATE TABLE workout_log_exercises (
  workout_log_id INT UNSIGNED NOT NULL,
  exercise_id    VARCHAR(64)  NOT NULL,
  PRIMARY KEY (workout_log_id, exercise_id),
  CONSTRAINT fk_wle_log FOREIGN KEY (workout_log_id)
    REFERENCES workout_logs (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- weekly_checkins: one energy rating (1-5) per person per week.
-- week_start = the Monday of that week in the user's timezone.
-- ---------------------------------------------------------------------
CREATE TABLE weekly_checkins (
  id         INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  person_id  INT UNSIGNED     NOT NULL,
  week_start DATE             NOT NULL,
  energy     TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP
                              ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_checkin_person_week (person_id, week_start),
  CONSTRAINT fk_checkin_person FOREIGN KEY (person_id)
    REFERENCES persons (id) ON DELETE CASCADE,
  CONSTRAINT chk_energy CHECK (energy BETWEEN 1 AND 5)
) ENGINE=InnoDB;