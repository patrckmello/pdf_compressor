import os
import uuid
import time
import subprocess
from flask import Flask, request, jsonify, send_file, render_template
from werkzeug.utils import secure_filename
import threading

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['PROCESSED_FOLDER'] = 'processed'

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)

tasks = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/compress', methods=['POST'])
def compress():
    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400

    file = request.files['file']
    compression_type = request.form.get('compression', 'screen') 

    if file.filename == '':
        return jsonify({'error': 'Nome de arquivo inválido'}), 400

    filename = secure_filename(file.filename)
    task_id = str(uuid.uuid4())
    input_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{task_id}_{filename}")
    output_path = os.path.join(app.config['PROCESSED_FOLDER'], f"comprimidoZG_{filename}")

    file.save(input_path)

    # Estima tempo com base no tamanho do arquivo
    file_size_mb = os.path.getsize(input_path) / (1024 * 1024)
    estimated_time = min(max(2, int(file_size_mb * 1.5)), 15)

    tasks[task_id] = {
        'percent': 0,
        'status': 'Iniciando compressão...'
    }

    def compress_and_simulate_progress():
        # Simula barra de progresso com base no tempo estimado
        def simulate_progress():
            for i in range(estimated_time * 10):
                percent = int((i / (estimated_time * 10)) * 90)
                tasks[task_id]['percent'] = percent
                tasks[task_id]['status'] = f"Comprimindo... {percent}%"
                time.sleep(0.2)

        progress_thread = threading.Thread(target=simulate_progress)
        progress_thread.start()

        cmd = [
            'gswin64c',
            '-sDEVICE=pdfwrite',
            '-dCompatibilityLevel=1.4',
            f'-dPDFSETTINGS=/{compression_type}', 
            '-dNOPAUSE',
            '-dBATCH',
            '-dQUIET',
            f'-sOutputFile={output_path}',
            input_path
        ]

        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        progress_thread.join()

        tasks[task_id]['percent'] = 100
        tasks[task_id]['status'] = 'Concluído!'
        tasks[task_id]['file'] = output_path

    threading.Thread(target=compress_and_simulate_progress).start()

    return jsonify({'task_id': task_id})

@app.route('/progress/<task_id>')
def progress(task_id):
    task = tasks.get(task_id)
    if not task:
        return jsonify({'error': 'Tarefa não encontrada'}), 404
    return jsonify({
        'percent': task['percent'],
        'status': task['status']
    })

from flask import after_this_request

import threading

@app.route('/download/<task_id>')
def download(task_id):
    task = tasks.get(task_id)
    if not task or 'file' not in task:
        return jsonify({'error': 'Arquivo não disponível'}), 404

    file_path = task['file']

    # Agendar limpeza após 5 segundos
    def cleanup():
        try:
            time.sleep(5)
            # Remove arquivos da pasta 'processed'
            for arquivo in os.listdir(app.config['PROCESSED_FOLDER']):
                caminho = os.path.join(app.config['PROCESSED_FOLDER'], arquivo)
                if os.path.isfile(caminho):
                    os.remove(caminho)

            # Remove arquivos da pasta 'uploads'
            for arquivo in os.listdir(app.config['UPLOAD_FOLDER']):
                caminho = os.path.join(app.config['UPLOAD_FOLDER'], arquivo)
                if os.path.isfile(caminho):
                    os.remove(caminho)
        except Exception as e:
            print(f"[ERRO] Falha ao limpar arquivos: {e}")

    threading.Thread(target=cleanup).start()

    return send_file(file_path, as_attachment=True)

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store'
    return response

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
