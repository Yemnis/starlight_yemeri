@echo off
REM Deploy Firestore indexes
REM This script deploys the Firestore composite indexes defined in firestore.indexes.json

echo 🚀 Deploying Firestore indexes...
echo.

REM Check if Firebase CLI is installed
where firebase >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Firebase CLI is not installed
    echo Install it with: npm install -g firebase-tools
    exit /b 1
)

REM Deploy indexes
echo Deploying indexes from firestore.indexes.json...
firebase deploy --only firestore:indexes --project gen-lang-client-0082081331

echo.
echo ✅ Index deployment initiated!
echo ⏳ Indexes typically take 2-5 minutes to build
echo 🔗 Check status at: https://console.firebase.google.com/project/gen-lang-client-0082081331/firestore/indexes

