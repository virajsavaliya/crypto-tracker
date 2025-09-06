source venv/bin/activate
python manage.py makemigrations 
python manage.py migrate
python manage.py start_websocket
python manage.py runserver
npm run dev

listen --forward-to http://localhost:8000/stripe-webhook/

<Button variant="outline" disabled className="w-1/2 text-gray-800 border-gray-300 rounded-xl hover:bg-gray-200">
                  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Google_Favicon_2025.svg/250px-Google_Favicon_2025.svg.png" alt="Google logo" className="mr-2 h-4 w-4" /> Google
                </Button>


'basic': 'price_1S2puODM44PIrnng5V9PSJkh', # Replace with your basic plan Price ID
    'enterprise': 'price_1S2q9jDM44PIrnngJaPoECdK', # Replace with your enterprise plan Price ID


    
stripe listen --forward-to localhost:8000/stripe-webhook/

git add .git commit -m "Update frontend to use environment variables for API URLs"
git push origin main
