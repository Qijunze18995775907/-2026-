# -*- coding: utf-8 -*-
"""v2.5 施工方案内审记录附件 探针"""
import io, os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = io.open(os.path.join(BASE, '质量管理台账工作台.html'), encoding='utf-8').read()
js = io.open(os.path.join(BASE, '_tmp', 'probe30.js'), encoding='utf-8').read()
probe = '<pre id="probe">PENDING</pre>\n<script>\n' + js + '\n</script>\n'
io.open(os.path.join(BASE, '_tmp', 'probe30.html'), 'w', encoding='utf-8').write(html + probe)
print('probe30 ok')
