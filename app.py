from datetime import datetime
from pathlib import Path

from flask import (
    Flask,
    request,
    render_template,
    send_file,
    abort,
)
from werkzeug.security import safe_join
from flask_autoindex import AutoIndex


logfile = Path('web.log')
STATIC_DIR = Path('static/')

app = Flask(__name__)

@app.before_request
def on_request():
    with open(logfile, 'a') as f:
        f.write(f'[{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}] {request.remote_addr} - {request.method} {request.path} {request.environ.get("SERVER_PROTOCOL")} - {request.user_agent}\n')

@app.after_request
def after_request(response):
    with open(logfile, 'a') as f:
        f.write(f'{response.status}\n')
    return response

@app.route('/')
def editor():
    return render_template('tabeditor.jinja')

TABS_DIR = Path('tabs/')
file_explorer = AutoIndex(app, TABS_DIR, add_url_rules=False)
@app.route('/tabs/')
@app.route('/tabs/<path:path>')
def tabs(path=''):
    if not path:
        return file_explorer.render_autoindex(path, endpoint=tabs, template='tabexplorer.jinja')
    file = Path(safe_join(TABS_DIR, path))
    if file.exists() and path.endswith('.atx'):
        if request.args.get('download') == 'true':
            return send_file(file, mimetype='text')
        return render_template('tabeditor.jinja',
                               alphaTex=file.read_text(),
                               readonly=True,
                               )
    abort(404)


if __name__ == '__main__':
    app.run('0.0.0.0', 8080, debug=True)
