import unittest
from app import app

class FlaskAppTestCase(unittest.TestCase):
    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_index_route(self):
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'BigQuery Pulse', response.data)

    def test_api_route(self):
        response = self.app.get('/api/release-notes')
        self.assertEqual(response.status_code, 200)
        json_data = response.get_json()
        self.assertEqual(json_data['status'], 'success')
        self.assertIn('data', json_data)
        self.assertGreater(len(json_data['data']), 0)
        
        # Verify schema of parsed notes
        first_item = json_data['data'][0]
        self.assertIn('id', first_item)
        self.assertIn('date', first_item)
        self.assertIn('category', first_item)
        self.assertIn('html', first_item)
        self.assertIn('text', first_item)
        self.assertIn('link', first_item)

if __name__ == '__main__':
    unittest.main()
