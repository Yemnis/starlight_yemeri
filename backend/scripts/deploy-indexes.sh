#!/bin/bash

# Deploy Firestore indexes
# This script deploys the Firestore composite indexes defined in firestore.indexes.json

echo "🚀 Deploying Firestore indexes..."
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null
then
    echo "❌ Firebase CLI is not installed"
    echo "Install it with: npm install -g firebase-tools"
    exit 1
fi

# Check if logged in
if ! firebase projects:list &> /dev/null
then
    echo "❌ Not logged into Firebase"
    echo "Login with: firebase login"
    exit 1
fi

# Deploy indexes
echo "Deploying indexes from firestore.indexes.json..."
firebase deploy --only firestore:indexes --project gen-lang-client-0082081331

echo ""
echo "✅ Index deployment initiated!"
echo "⏳ Indexes typically take 2-5 minutes to build"
echo "🔗 Check status at: https://console.firebase.google.com/project/gen-lang-client-0082081331/firestore/indexes"

