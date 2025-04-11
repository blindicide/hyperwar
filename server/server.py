from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json

app = Flask(__name__)
CORS(app)

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

FILES = {
    'units': os.path.join(DATA_DIR, 'units.json'),
    'weapons': os.path.join(DATA_DIR, 'weapons.json'),
    'ammo': os.path.join(DATA_DIR, 'ammo.json'),
    'factions': os.path.join(DATA_DIR, 'factions.json'),
    'groups': os.path.join(DATA_DIR, 'groups.json') # Added groups
}

# Ensure files exist
for path in FILES.values():
    if not os.path.exists(path):
        with open(path, 'w') as f:
            json.dump({}, f)

def load_data(file_path):
    with open(file_path, 'r') as f:
        return json.load(f)

def save_data(file_path, data):
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2)

@app.route('/<data_type>', methods=['GET'])
def get_data(data_type):
    if data_type not in FILES:
        return 'Invalid data type', 404
    data = load_data(FILES[data_type])
    return jsonify(data)

@app.route('/<data_type>', methods=['POST'])
def save_item(data_type):
    if data_type not in FILES:
        return 'Invalid data type', 404
    data = load_data(FILES[data_type])
    req = request.get_json()
    if not req or 'id' not in req or 'item' not in req:
        return 'Missing id or item', 400
    data[req['id']] = req['item']
    save_data(FILES[data_type], data)
    return jsonify({'success': True})

@app.route('/<data_type>/<item_id>', methods=['DELETE'])
def delete_item(data_type, item_id):
    if data_type not in FILES:
        return 'Invalid data type', 404
    data = load_data(FILES[data_type])
    if item_id in data:
        del data[item_id]
        save_data(FILES[data_type], data)
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)
