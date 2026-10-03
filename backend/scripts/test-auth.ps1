# Full auth flow test: register -> login -> me -> refresh -> reuse (must fail) -> logout
$Base = 'http://localhost:3000'
$ErrorActionPreference = 'Stop'

function Invoke-Api {
    param([string]$Method, [string]$Path, $Body, [string]$AccessToken)
    $params = @{
        Method      = $Method
        Uri         = "$Base$Path"
        ContentType = 'application/json'
    }
    if ($null -ne $Body) { $params.Body = ($Body | ConvertTo-Json -Compress) }
    if ($AccessToken)    { $params.Headers = @{ Authorization = "Bearer $AccessToken" } }
    try {
        $r = Invoke-WebRequest @params -UseBasicParsing
        $json = if ($r.Content) { $r.Content | ConvertFrom-Json } else { $null }
        return @{ Status = $r.StatusCode; Json = $json }
    } catch {
        $resp = $_.Exception.Response
        $status = if ($resp) { [int]$resp.StatusCode } else { 0 }
        $content = if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            $_.ErrorDetails.Message
        } elseif ($resp) {
            (New-Object System.IO.StreamReader($resp.GetResponseStream())).ReadToEnd()
        } else { '' }
        $json = if ($content) { try { $content | ConvertFrom-Json } catch { $null } } else { $null }
        return @{ Status = $status; Json = $json }
    }
}

function Show($label, $r) {
    Write-Host "`n=== $label -> $($r.Status) ===" -ForegroundColor Cyan
    if ($r.Json) { $r.Json | ConvertTo-Json -Depth 6 }
}

# 0. Server up?
Show 'GET /health' (Invoke-Api Get '/health')

# 1. Register
$reg = Invoke-Api Post '/auth/register' @{
    username = 'alex'; password = 'passw0rd1'
    fullName = 'Alex Doe'; timezone = 'Europe/London'
}
Show 'POST /auth/register' $reg

# 1b. Duplicate username -> expect 409 USERNAME_TAKEN
Show 'POST /auth/register (duplicate)' (Invoke-Api Post '/auth/register' @{
    username = 'alex'; password = 'passw0rd1'; fullName = 'Alex Doe'
})

# 2. Login
$login = Invoke-Api Post '/auth/login' @{ username = 'alex'; password = 'passw0rd1' }
Show 'POST /auth/login' $login
$access  = $login.Json.tokens.accessToken
$refresh = $login.Json.tokens.refreshToken

# 2b. Wrong password -> expect 401
Show 'POST /auth/login (wrong password)' (Invoke-Api Post '/auth/login' @{
    username = 'alex'; password = 'wrongpass1'
})

# 3. Me with access token
Show 'GET /auth/me' (Invoke-Api Get '/auth/me' $null $access)

# 3b. Me without token -> expect 401
Show 'GET /auth/me (no token)' (Invoke-Api Get '/auth/me')

# 4. Refresh (rotates: old refresh token dies)
$new = Invoke-Api Post '/auth/refresh' @{ refreshToken = $refresh }
Show 'POST /auth/refresh' $new

# 5. Reuse the OLD refresh token -> expect 401 (and all user tokens revoked)
Show 'POST /auth/refresh (reuse old token)' (Invoke-Api Post '/auth/refresh' @{ refreshToken = $refresh })

# 6. Logout with the NEW token -> expect 204
Show 'POST /auth/logout' (Invoke-Api Post '/auth/logout' @{ refreshToken = $new.Json.tokens.refreshToken } $new.Json.tokens.accessToken)

# --- B4: /me, /me/avatar, /goals --------------------------------------
$login2 = Invoke-Api Post '/auth/login' @{ username = 'alex'; password = 'passw0rd1' }
$t = $login2.Json.tokens.accessToken

Show 'GET /me' (Invoke-Api Get '/me' $null $t)
Show 'PATCH /me/avatar' (Invoke-Api Patch '/me/avatar' @{ avatarShape = 'slim'; avatarColor = 'sky' } $t)
Show 'PATCH /me/avatar (unknown id)' (Invoke-Api Patch '/me/avatar' @{ avatarShape = 'hacker' } $t)
Show 'PATCH /me/avatar (empty body)' (Invoke-Api Patch '/me/avatar' @{} $t)
Show 'GET /me (no token)' (Invoke-Api Get '/me')
Show 'GET /goals' (Invoke-Api Get '/goals')

# --- B6: POST /me/test ------------------------------------------------
$login3 = Invoke-Api Post '/auth/login' @{ username = 'alex'; password = 'passw0rd1' }
$t = $login3.Json.tokens.accessToken

$testBody = @{
  birthDate                 = '1998-04-15'
  heightCm                  = 178
  weightKg                  = 74
  jobType                   = 'Sedentary'
  weightTraining            = 'Moderate'
  cardioHistory             = 'Low'
  availabilityHoursPerDay   = 1.5
  healthIssueCount          = 0
  goalId                    = 'G03'
  gender                    = 'male'
}

Show 'POST /me/test' (Invoke-Api Post '/me/test' $testBody $t)
Show 'POST /me/test (again -> 409)' (Invoke-Api Post '/me/test' $testBody $t)
Show 'GET /me (testDone now true)' (Invoke-Api Get '/me' $null $t)

# --- B7: GET /me/plan --------------------------------------------------
$login4 = Invoke-Api Post '/auth/login' @{ username = 'alex'; password = 'passw0rd1' }
$t = $login4.Json.tokens.accessToken

Show 'GET /me/plan' (Invoke-Api Get '/me/plan' $null $t)
Show 'GET /me/plan (no token)' (Invoke-Api Get '/me/plan')
# --- B8: workouts -----------------------------------------------------
$login5 = Invoke-Api Post '/auth/login' @{ username = 'alex'; password = 'passw0rd1' }
$t = $login5.Json.tokens.accessToken

# Find the first training day in the plan and compute its actual date.
# Today may be a rest day, so we can't rely on `today.exercises` being populated.
$plan = Invoke-Api Get '/me/plan' $null $t
$startedAt = [DateTime]::ParseExact($plan.Json.plan.startedAt, 'yyyy-MM-dd', $null)
$trainDay  = $plan.Json.plan.days | Where-Object { -not $_.is_rest } | Select-Object -First 1
$trainDate = $startedAt.AddDays($trainDay.day - 1).ToString('yyyy-MM-dd')
$trainType = $trainDay.types[0]
$exercises = $trainDay.exercises.$trainType

$firstExercise  = $exercises[0].exercise_id
$secondExercise = $exercises[1].exercise_id
$thirdExercise  = $exercises[2].exercise_id

Show "GET /me/workouts/$trainDate (no log yet)" (Invoke-Api Get "/me/workouts/$trainDate" $null $t)

Show "PUT /me/workouts (1 of $($exercises.Count))" (Invoke-Api Put "/me/workouts/$trainDate" @{
  completedExerciseIds = @($firstExercise)
} $t)

Show "PUT /me/workouts (3 of $($exercises.Count) -> completed)" (Invoke-Api Put "/me/workouts/$trainDate" @{
  completedExerciseIds = @($firstExercise, $secondExercise, $thirdExercise)
} $t)

Show 'PUT /me/workouts (unknown id -> 400)' (Invoke-Api Put "/me/workouts/$trainDate" @{
  completedExerciseIds = @('not_a_real_exercise')
} $t)

Show 'PUT /me/workouts (future date -> 400)' (Invoke-Api Put "/me/workouts/2999-01-01" @{
  completedExerciseIds = @()
} $t)

Show 'PUT /me/workouts (bad date -> 400)' (Invoke-Api Put "/me/workouts/2025-13-99" @{
  completedExerciseIds = @()
} $t)

Show "GET /me/workouts/$trainDate (log now present)" (Invoke-Api Get "/me/workouts/$trainDate" $null $t)

Show 'GET /me/workouts (no token -> 401)' (Invoke-Api Get "/me/workouts/$trainDate")

# --- Streaks ----------------------------------------------------------
$login9 = Invoke-Api Post '/auth/login' @{ username = 'alex'; password = 'passw0rd1' }
$t = $login9.Json.tokens.accessToken

Show 'GET /me/streak (week)' (Invoke-Api Get '/me/streak' $null $t)
Show 'GET /me/streak?days=30 (month)' (Invoke-Api Get '/me/streak?days=30' $null $t)
Show 'GET /me/streak?days=0 (400)' (Invoke-Api Get '/me/streak?days=0' $null $t)
Show 'GET /me/streak?days=999 (400)' (Invoke-Api Get '/me/streak?days=999' $null $t)
Show 'GET /me/streak (no token -> 401)' (Invoke-Api Get '/me/streak')
# --- B9: daily logs ---------------------------------------------------
$login6 = Invoke-Api Post '/auth/login' @{ username = 'alex'; password = 'passw0rd1' }
$t = $login6.Json.tokens.accessToken

Show 'GET /me/daily (fresh)' (Invoke-Api Get '/me/daily' $null $t)
Show 'PATCH /me/daily (water only)' (Invoke-Api Patch '/me/daily' @{ waterMl = 500 } $t)
Show 'PATCH /me/daily (add sleep -> water kept)' (Invoke-Api Patch '/me/daily' @{ sleepHours = 7.5 } $t)
Show 'PATCH /me/daily (more water)' (Invoke-Api Patch '/me/daily' @{ waterMl = 1500 } $t)
Show 'PATCH /me/daily (clear water)' (Invoke-Api Patch '/me/daily' @{ waterMl = $null } $t)
Show 'PATCH /me/daily (empty -> 400)' (Invoke-Api Patch '/me/daily' @{} $t)
Show 'PATCH /me/daily (over max -> 400)' (Invoke-Api Patch '/me/daily' @{ waterMl = 99999 } $t)
Show 'GET /me/daily (final)' (Invoke-Api Get '/me/daily' $null $t)
Show 'GET /me/daily (no token -> 401)' (Invoke-Api Get '/me/daily')
# --- B9/B10: streaks --------------------------------------------------
$login8 = Invoke-Api Post '/auth/login' @{ username = 'alex'; password = 'passw0rd1' }
$t = $login8.Json.tokens.accessToken

Show 'GET /me/streak (week)' (Invoke-Api Get '/me/streak' $null $t)
Show 'GET /me/streak?days=30 (month)' (Invoke-Api Get '/me/streak?days=30' $null $t)
Show 'GET /me/streak?days=0 (400)' (Invoke-Api Get '/me/streak?days=0' $null $t)
Show 'GET /me/streak?days=999 (400)' (Invoke-Api Get '/me/streak?days=999' $null $t)
Show 'GET /me/streak (no token -> 401)' (Invoke-Api Get '/me/streak')
# --- B10: daily recent + date variants --------------------------------
$login10 = Invoke-Api Post '/auth/login' @{ username = 'alex'; password = 'passw0rd1' }
$t = $login10.Json.tokens.accessToken
$today     = Get-Date -Format 'yyyy-MM-dd'
$yesterday = (Get-Date).AddDays(-1).ToString('yyyy-MM-dd')

Show 'GET /me (with today)' (Invoke-Api Get '/me' $null $t)
Show 'PATCH /me/daily (today water)' (Invoke-Api Patch '/me/daily' @{ waterMl = 1500 } $t)
Show 'PATCH /me/daily/yesterday (retro)' (Invoke-Api Patch "/me/daily/$yesterday" @{ waterMl = 2000; sleepHours = 8 } $t)
Show 'GET /me/daily/yesterday' (Invoke-Api Get "/me/daily/$yesterday" $null $t)
Show 'GET /me/daily/recent?days=7' (Invoke-Api Get '/me/daily/recent?days=7' $null $t)
Show 'GET /me/daily/recent?days=30' (Invoke-Api Get '/me/daily/recent?days=30' $null $t)
Show 'GET /me/daily/recent?days=0 -> 400' (Invoke-Api Get '/me/daily/recent?days=0' $null $t)
Show 'GET /me/daily/tomorrow -> 400' (Invoke-Api Get '/me/daily/2999-01-01' $null $t)
Show 'GET /me/daily/bad-date -> 400' (Invoke-Api Get '/me/daily/2025-13-99' $null $t)
Show 'GET /me/daily/recent (no token -> 401)' (Invoke-Api Get '/me/daily/recent')