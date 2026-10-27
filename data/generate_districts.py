#!/usr/bin/env python3
"""
100% Raw Excel Data Generator for Rajasthan CVS Dashboard.
Sourced strictly from the field Excel workbooks in /var/www/dashboard/data/
Target Districts:
  1:  Jodhpur  (1Dataset_Jodhpur_Oct26.xlsx)
  5:  Kota     (5Dataset_kota_Oct26.xlsx)
  6:  Bundi    (6_Dataset_Bundi_Oct26.xlsx)
  7:  Jhalawar (7Dataset_Jhalawar_Oct26.xlsx)
  8:  Baran    (8Dataset_Baran_Oct26.xlsx)
  15: Pali     (15Dataset_Pali_Oct26.xlsx)
  16: Ajmer    (16Dataset_Ajmer_Oct26.xlsx)

NO static multipliers, NO external datasets, NO synthetic numbers.
"""

import os
import re
import json
import openpyxl

DISTRICTS_CONFIG = {
    'jodhpur': {
        'num': 1,
        'name': 'Jodhpur',
        'file': '1Dataset_Jodhpur_Oct26.xlsx',
        'center': [26.50, 72.85],
        'zoom': 8,
        'dist_code': '910811300000000000',
        'block_centroids': {
            'AAU': [27.08, 72.88], 'BALESAR': [26.40, 72.48], 'BAAP': [27.37, 72.36],
            'BAPINI': [26.96, 72.84], 'BHOPALGARH': [26.65, 73.45], 'BILARA': [26.18, 73.71],
            'CHAMU': [26.65, 72.58], 'DECHU': [26.83, 72.33], 'DHAWA': [26.06, 72.76],
            'GHANTIYALI': [27.21, 72.63], 'KERU': [26.32, 72.88], 'LOHAWAT': [26.98, 72.60],
            'LUNI': [26.05, 73.02], 'MANDOR': [26.35, 73.04], 'OSIAN': [26.72, 72.90],
            'PEEPAD SAHAR': [26.38, 73.55], 'PHALODI': [27.13, 72.36], 'SEKHALA': [26.32, 72.40],
            'BAWADI': [26.60, 73.08], 'TINWARI': [26.54, 72.95], 'SHERGARH': [26.32, 72.28]
        }
    },
    'kota': {
        'num': 5,
        'name': 'Kota',
        'file': '5Dataset_kota_Oct26.xlsx',
        'center': [25.18, 75.83],
        'zoom': 9,
        'dist_code': '910812700000000000',
        'block_centroids': {
            'SANGOD': [24.92, 76.28], 'KHERABAD': [24.71, 75.95], 'KHAIRABAD': [24.71, 75.95],
            'SULTANPUR': [25.30, 76.17], 'LADPURA': [25.18, 75.85], 'ITAWA': [25.50, 76.50]
        }
    },
    'bundi': {
        'num': 6,
        'name': 'Bundi',
        'file': '6_Dataset_Bundi_Oct26.xlsx',
        'center': [25.44, 75.64],
        'zoom': 9,
        'dist_code': '910812100000000000',
        'block_centroids': {
            'BUNDI': [25.44, 75.64], 'TALEDA': [25.26, 75.81], 'TALERA': [25.26, 75.81],
            'K.PATAN': [25.31, 75.93], 'KESHORAIPATAN': [25.31, 75.93], 'NAINWA': [25.77, 75.85],
            'HINDOLI': [25.58, 75.50]
        }
    },
    'jhalawar': {
        'num': 7,
        'name': 'Jhalawar',
        'file': '7Dataset_Jhalawar_Oct26.xlsx',
        'center': [24.59, 76.16],
        'zoom': 9,
        'dist_code': '910812900000000000',
        'block_centroids': {
            'AKLERA': [24.41, 76.56], 'J.PATAN': [24.54, 76.18], 'JHALRAPATAN': [24.54, 76.18],
            'M THANA': [24.24, 76.81], 'MANOHAR THANA': [24.24, 76.81], 'KHANPUR': [24.73, 76.39],
            'BAKANI': [24.28, 76.24], 'DAG': [23.91, 75.83], 'PIDAWA': [24.18, 75.98],
            'BH MANDI': [24.42, 75.83], 'BHAWANI MANDI': [24.42, 75.83]
        }
    },
    'baran': {
        'num': 8,
        'name': 'Baran',
        'file': '8Dataset_Baran_Oct26.xlsx',
        'center': [25.10, 76.51],
        'zoom': 9,
        'dist_code': '910812800000000000',
        'block_centroids': {
            'ATRU': [24.87, 76.65], 'ANTA': [25.15, 76.30], 'BARAN': [25.10, 76.51],
            'CHABDA': [24.62, 76.84], 'MANGROL': [25.33, 76.51], 'CHHIPABROD': [24.58, 76.68],
            'KISHANGANJ': [25.13, 76.82], 'SHAHBAD': [25.19, 77.17]
        }
    },
    'pali': {
        'num': 15,
        'name': 'Pali',
        'file': '15Dataset_Pali_Oct26.xlsx',
        'center': [25.77, 73.32],
        'zoom': 9,
        'dist_code': '910811800000000000',
        'block_centroids': {
            'DESURI': [25.27, 73.56], 'BALI': [25.18, 73.29], 'JAITARAN': [26.20, 73.94],
            'MARWAR JUNCTION': [25.72, 73.61], 'PALI': [25.77, 73.32], 'RAIPUR': [26.04, 74.02],
            'ROHAT': [25.96, 73.13], 'SOJAT': [25.92, 73.67], 'SUMERPUR': [25.15, 73.08],
            'RANI': [25.35, 73.31]
        }
    },
    'ajmer': {
        'num': 16,
        'name': 'Ajmer',
        'file': '16Dataset_Ajmer_Oct26.xlsx',
        'center': [26.45, 74.64],
        'zoom': 9,
        'dist_code': '910811900000000000',
        'block_centroids': {
            'PEESANGAN': [26.40, 74.41], 'ARAIN': [26.15, 75.05], 'BHINAY': [26.04, 74.79],
            'MASUDA': [26.10, 74.51], 'JAWAJA': [25.95, 74.22], 'SHREENAGAR': [26.43, 74.76],
            'KEKRI': [25.97, 75.15], 'SILORA- KISHANGARH': [26.58, 74.87], 'KISHANGARH': [26.58, 74.87]
        }
    }
}

DIST_NAMES = {'jodhpur', 'kota', 'bundi', 'jhalawar', 'baran', 'pali', 'ajmer'}
HEADER_FILTER = {
    'village', 'village name', 'name of village', 'panchayat', 'gram panchayat',
    'district', 'none', 'total', 'hac', 'ha', 'code', 'code11', 'no.', '%', 's.no.'
}

BLOCK_NAME_CLEAN = {
    'TALEDA': 'TALERA',
    'K.PATAN': 'KESHORAIPATAN',
    'J.PATAN': 'JHALRAPATAN',
    'M THANA': 'MANOHAR THANA',
    'BH MANDI': 'BHAWANI MANDI',
    'KHERABAD': 'KHAIRABAD',
    'SILORA- KISHANGARH': 'KISHANGARH'
}

def to_f(val):
    if val is None:
        return 0.0
    try:
        s = str(val).strip().replace(',', '')
        return float(s)
    except:
        return 0.0

def to_i(val):
    if val is None:
        return 0
    try:
        s = str(val).strip().replace(',', '')
        return int(float(s))
    except:
        return 0

def clean_name(s):
    if not s:
        return ''
    s = str(s).strip()
    return re.sub(r'\s+', ' ', s)

def process_district(dist_id, cfg, data_dir='/var/www/dashboard/data'):
    fpath = os.path.join(data_dir, cfg['file'])
    print(f"=== Processing {cfg['name']} (District {cfg['num']}) from {fpath} ===")
    wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)

    villages = []
    plots = []
    blocks_data = {}

    for sname in wb.sheetnames:
        sheet = wb[sname]
        raw_bname = sname.replace('FF ', '').replace(' Block', '').strip().upper()
        if raw_bname in ('SHEET1', 'FORMAT'):
            continue

        bname = BLOCK_NAME_CLEAN.get(raw_bname, raw_bname)
        centroid = cfg['block_centroids'].get(raw_bname, cfg['block_centroids'].get(bname, cfg['center']))

        rows = list(sheet.iter_rows(values_only=True))
        if len(rows) < 3:
            continue

        # Header detection
        h_idx = 1
        for ri in range(min(4, len(rows))):
            line = [str(c).strip().lower() if c is not None else '' for c in rows[ri]]
            if any('village' in c for c in line) and any('geographical' in c for c in line):
                h_idx = ri
                break

        for r_idx in range(h_idx + 1, len(rows)):
            r = rows[r_idx]
            if not r or not any(r):
                continue

            r0 = str(r[0]).strip().lower() if r[0] is not None else ''
            r1 = str(r[1]).strip().lower() if len(r) > 1 and r[1] is not None else ''

            if r0 in DIST_NAMES:
                offset = 0
            elif r1 in DIST_NAMES or r0.isdigit() or r0 in ('p', 's'):
                offset = 1
            else:
                offset = 0

            vname = clean_name(r[3 + offset] if len(r) > (3 + offset) and r[3 + offset] else '')
            v_clean = vname.strip().lower()
            if not vname or v_clean in HEADER_FILTER or v_clean.startswith('total') or v_clean == 'grand total':
                continue

            pname = clean_name(r[2 + offset] if len(r) > (2 + offset) and r[2 + offset] else '')
            if not pname or pname.strip().lower() in HEADER_FILTER:
                pname = 'GENERAL'
            pname = pname.upper()

            code = clean_name(r[4 + offset] if len(r) > (4 + offset) and r[4 + offset] else '')
            ga = to_f(r[5 + offset] if len(r) > (5 + offset) else 0)

            # Fix if census code was in column 5
            if ga > 35000:
                code = str(int(ga))
                ga = to_f(r[6 + offset] if len(r) > (6 + offset) else 0)
                hh = to_i(r[7 + offset] if len(r) > (7 + offset) else 0)
                pop = to_i(r[8 + offset] if len(r) > (8 + offset) else 0)
                m = to_i(r[9 + offset] if len(r) > (9 + offset) else 0)
                f = to_i(r[10 + offset] if len(r) > (10 + offset) else 0)
                sc = to_i(r[11 + offset] if len(r) > (11 + offset) else 0)
                st = to_i(r[13 + offset] if len(r) > (13 + offset) else 0)
                pas = to_f(r[15 + offset] if len(r) > (15 + offset) else 0)
                cfrr = to_f(r[16 + offset] if len(r) > (16 + offset) else 0)
                cvs_res = str(r[17 + offset]).strip().upper() if len(r) > (17 + offset) and r[17 + offset] else ''
                cvs_date = clean_name(r[18 + offset] if len(r) > (18 + offset) and r[18 + offset] else '')
                pasture_appl_ha = to_f(r[19 + offset] if len(r) > (19 + offset) else 0)
                pasture_recog_ha = to_f(r[20 + offset] if len(r) > (20 + offset) else 0)
                asset_reg = str(r[21 + offset]).strip().upper() if len(r) > (21 + offset) and r[21 + offset] else ''
                bylaws = str(r[22 + offset]).strip().upper() if len(r) > (22 + offset) and r[22 + offset] else ''
                demarc = str(r[23 + offset]).strip().upper() if len(r) > (23 + offset) and r[23 + offset] else ''
                encroach_ha = to_f(r[25 + offset] if len(r) > (25 + offset) else 0)
                vbg_ha = to_f(r[28 + offset] if len(r) > (28 + offset) else 0)
                vbg_work = clean_name(r[29 + offset] if len(r) > (29 + offset) else '')
                c1_val = r[30 + offset] if len(r) > (30 + offset) else None
                c2_val = r[31 + offset] if len(r) > (31 + offset) else None
            else:
                hh = to_i(r[6 + offset] if len(r) > (6 + offset) else 0)
                pop = to_i(r[7 + offset] if len(r) > (7 + offset) else 0)
                m = to_i(r[8 + offset] if len(r) > (8 + offset) else 0)
                f = to_i(r[9 + offset] if len(r) > (9 + offset) else 0)
                sc = to_i(r[10 + offset] if len(r) > (10 + offset) else 0)
                st = to_i(r[12 + offset] if len(r) > (12 + offset) else 0)
                pas = to_f(r[14 + offset] if len(r) > (14 + offset) else 0)
                cfrr = to_f(r[15 + offset] if len(r) > (15 + offset) else 0)
                cvs_res = str(r[16 + offset]).strip().upper() if len(r) > (16 + offset) and r[16 + offset] else ''
                cvs_date = clean_name(r[17 + offset] if len(r) > (17 + offset) and r[17 + offset] else '')
                pasture_appl_ha = to_f(r[18 + offset] if len(r) > (18 + offset) else 0)
                pasture_recog_ha = to_f(r[19 + offset] if len(r) > (19 + offset) else 0)
                asset_reg = str(r[20 + offset]).strip().upper() if len(r) > (20 + offset) and r[20 + offset] else ''
                bylaws = str(r[21 + offset]).strip().upper() if len(r) > (21 + offset) and r[21 + offset] else ''
                demarc = str(r[22 + offset]).strip().upper() if len(r) > (22 + offset) and r[22 + offset] else ''
                encroach_ha = to_f(r[24 + offset] if len(r) > (24 + offset) else 0)
                vbg_ha = to_f(r[27 + offset] if len(r) > (27 + offset) else 0)
                vbg_work = clean_name(r[28 + offset] if len(r) > (28 + offset) else '')
                c1_val = r[29 + offset] if len(r) > (29 + offset) else None
                c2_val = r[30 + offset] if len(r) > (30 + offset) else None

            # Commons in Excel is Pasture + Potential CFRR
            com = round(pas + cfrr, 2)

            # Exact GPS Coordinates parsing from Excel
            lat = None
            lng = None
            is_exact = False
            if c1_val is not None and c2_val is not None:
                try:
                    c1 = float(str(c1_val).strip())
                    c2 = float(str(c2_val).strip())
                    if (23.0 <= c1 <= 30.5 and 69.0 <= c2 <= 79.5):
                        lat, lng = c1, c2
                        is_exact = True
                    elif (23.0 <= c2 <= 30.5 and 69.0 <= c1 <= 79.5):
                        lat, lng = c2, c1
                        is_exact = True
                except:
                    pass

            # If no exact GPS recorded in Excel, place at block centroid
            if not is_exact:
                lat = centroid[0]
                lng = centroid[1]
                is_exact = False

            cvs_is_yes = ('Y' in cvs_res or 'YES' in cvs_res or len(cvs_date) > 2)
            demarc_is_yes = ('Y' in demarc or 'YES' in demarc)
            bylaws_is_yes = ('Y' in bylaws or 'YES' in bylaws)
            asset_is_yes = ('Y' in asset_reg or 'YES' in asset_reg)

            # Work plots from Excel (only for rows having actual works/tenure/actions)
            v_plots = []
            has_intervention = (vbg_ha > 0) or (len(vbg_work) > 2) or (pasture_recog_ha > 0) or (encroach_ha > 0) or cvs_is_yes
            if has_intervention:
                plot_area = vbg_ha if vbg_ha > 0 else (pasture_recog_ha if pasture_recog_ha > 0 else (pas if pas > 0 else 0.0))
                plot_name = vbg_work if vbg_work else (f"Charagah Vikas ({vname})" if pas > 0 else f"CVS Sanrakshan ({vname})")
                is_water = any(w in plot_name.lower() for w in ['nadi', 'talab', 'water', 'pond', 'bandha', 'khudai', 'desilt', 'anicut'])
                plot_obj = {
                    'id': len(plots) + 1,
                    'block': bname,
                    'panchayat': pname,
                    'village': vname,
                    'code': code,
                    'name': plot_name,
                    'lat': lat,
                    'lng': lng,
                    'is_exact': is_exact,
                    'area_ha': round(plot_area, 2),
                    'status': 'COMPLETED' if cvs_is_yes else 'ACTIVE',
                    'cvs': 'Y' if cvs_is_yes else 'N',
                    'cvs_date': cvs_date,
                    'bylaws': 'Y' if bylaws_is_yes else 'N',
                    'demarcation': 'Y' if demarc_is_yes else 'N',
                    'asset_register': 'Y' if asset_is_yes else 'N',
                    'encroachment_removed_ha': round(encroach_ha, 2),
                    'tenure_recognized_ha': round(pasture_recog_ha, 2),
                    'scheme': 'VBGRAMG',
                    'water_structure': is_water
                }
                plots.append(plot_obj)
                v_plots.append(plot_obj)

            v_obj = {
                'id': len(villages) + 1,
                'b': bname,
                'p': pname,
                'v': vname,
                'c': code,
                'ga': round(ga, 2),
                'hh': hh,
                'pop': pop,
                'm': m,
                'f': f,
                'sc': sc,
                'st': st,
                'pas': round(pas, 2),
                'cfrr': round(cfrr, 2),
                'com': com,
                'vbg_ha': round(vbg_ha, 2),
                'vbg_work': vbg_work,
                'cvs': 'Y' if cvs_is_yes else 'N',
                'cvs_date': cvs_date,
                'bylaws': 'Y' if bylaws_is_yes else 'N',
                'demarcation': 'Y' if demarc_is_yes else 'N',
                'asset_register': 'Y' if asset_is_yes else 'N',
                'encroach_ha': round(encroach_ha, 2),
                'pasture_recog_ha': round(pasture_recog_ha, 2),
                'lat': lat,
                'lng': lng,
                'is_exact': is_exact,
                'plots': v_plots
            }
            villages.append(v_obj)

            if bname not in blocks_data:
                blocks_data[bname] = {
                    'name': bname,
                    'villages': 0,
                    'geo_area': 0.0,
                    'households': 0,
                    'population': 0,
                    'male': 0,
                    'female': 0,
                    'sc_pop': 0,
                    'st_pop': 0,
                    'pasture': 0.0,
                    'cfrr': 0.0,
                    'common_land': 0.0,
                    'vbgramg_ha': 0.0,
                    'vbgramg_villages': 0,
                    'cvs_villages': 0,
                    'demarcated_villages': 0,
                    'bylaws_villages': 0,
                    'encroach_ha': 0.0,
                    'pasture_recog_ha': 0.0,
                    'panchayats_map': {},
                    'plots_count': 0
                }

            bd = blocks_data[bname]
            bd['villages'] += 1
            bd['geo_area'] += ga
            bd['households'] += hh
            bd['population'] += pop
            bd['male'] += m
            bd['female'] += f
            bd['sc_pop'] += sc
            bd['st_pop'] += st
            bd['pasture'] += pas
            bd['cfrr'] += cfrr
            bd['common_land'] += com
            bd['vbgramg_ha'] += vbg_ha
            if vbg_ha > 0:
                bd['vbgramg_villages'] += 1
            if cvs_is_yes:
                bd['cvs_villages'] += 1
            if demarc_is_yes:
                bd['demarcated_villages'] += 1
            if bylaws_is_yes:
                bd['bylaws_villages'] += 1
            bd['encroach_ha'] += encroach_ha
            bd['pasture_recog_ha'] += pasture_recog_ha
            bd['plots_count'] += len(v_plots)

            if pname not in bd['panchayats_map']:
                bd['panchayats_map'][pname] = {
                    'name': pname,
                    'villages': 0,
                    'area': 0.0,
                    'households': 0,
                    'pop': 0,
                    'sc': 0,
                    'st': 0,
                    'pasture': 0.0,
                    'cfrr': 0.0,
                    'commons': 0.0,
                    'vbgramg_ha': 0.0
                }
            pd = bd['panchayats_map'][pname]
            pd['villages'] += 1
            pd['area'] += ga
            pd['households'] += hh
            pd['pop'] += pop
            pd['sc'] += sc
            pd['st'] += st
            pd['pasture'] += pas
            pd['cfrr'] += cfrr
            pd['commons'] += com
            pd['vbgramg_ha'] += vbg_ha

    wb.close()

    # Aggregate district totals
    tot_geo = sum(b['geo_area'] for b in blocks_data.values())
    tot_hh = sum(b['households'] for b in blocks_data.values())
    tot_pop = sum(b['population'] for b in blocks_data.values())
    tot_m = sum(b['male'] for b in blocks_data.values())
    tot_f = sum(b['female'] for b in blocks_data.values())
    tot_sc = sum(b['sc_pop'] for b in blocks_data.values())
    tot_st = sum(b['st_pop'] for b in blocks_data.values())
    tot_pas = sum(b['pasture'] for b in blocks_data.values())
    tot_cfrr = sum(b['cfrr'] for b in blocks_data.values())
    tot_com = sum(b['common_land'] for b in blocks_data.values())
    tot_vbg_ha = sum(b['vbgramg_ha'] for b in blocks_data.values())
    tot_vbg_vil = sum(b['vbgramg_villages'] for b in blocks_data.values())
    tot_cvs_vil = sum(b['cvs_villages'] for b in blocks_data.values())
    tot_demarc_vil = sum(b['demarcated_villages'] for b in blocks_data.values())
    tot_bylaws_vil = sum(b['bylaws_villages'] for b in blocks_data.values())
    tot_encroach = sum(b['encroach_ha'] for b in blocks_data.values())
    tot_recog = sum(b['pasture_recog_ha'] for b in blocks_data.values())

    tot_panchayats = sum(len(b['panchayats_map']) for b in blocks_data.values())
    dist_sex_ratio = round((tot_f / max(1, tot_m)) * 1000, 1)

    summary_blocks = []
    for bname, bd in sorted(blocks_data.items()):
        b_pop = max(1, bd['population'])
        b_sc_pct = round((bd['sc_pop'] / b_pop) * 100, 2)
        b_st_pct = round((bd['st_pop'] / b_pop) * 100, 2)
        b_vul_pct = round(((bd['sc_pop'] + bd['st_pop']) / b_pop) * 100, 2)
        b_sex_ratio = round((bd['female'] / max(1, bd['male'])) * 1000, 1)
        b_geo = max(1.0, bd['geo_area'])
        b_com_pct = round((bd['common_land'] / b_geo) * 100, 2)
        b_pas_pct = round((bd['pasture'] / b_geo) * 100, 2)
        b_hh = max(1, bd['households'])
        b_com_per_hh = round(bd['common_land'] / b_hh, 2)

        panchayats_list = []
        for pname, pd in sorted(bd['panchayats_map'].items()):
            p_pop = max(1, pd['pop'])
            panchayats_list.append({
                'name': pname,
                'villages': pd['villages'],
                'area': round(pd['area'], 2),
                'households': pd['households'],
                'pop': pd['pop'],
                'sc_pct': round((pd['sc'] / p_pop) * 100, 1),
                'st_pct': round((pd['st'] / p_pop) * 100, 1),
                'pasture': round(pd['pasture'], 2),
                'cfrr': round(pd['cfrr'], 2),
                'commons': round(pd['commons'], 2),
                'vbgramg_ha': round(pd['vbgramg_ha'], 2),
                'com_pct': round((pd['commons'] / max(1.0, pd['area'])) * 100, 1)
            })

        summary_blocks.append({
            'name': bname,
            'gps': len(bd['panchayats_map']),
            'villages': bd['villages'],
            'geo_area': round(bd['geo_area'], 2),
            'households': bd['households'],
            'population': bd['population'],
            'male': bd['male'],
            'female': bd['female'],
            'sex_ratio': b_sex_ratio,
            'sc_pop': bd['sc_pop'],
            'sc_pct': b_sc_pct,
            'st_pop': bd['st_pop'],
            'st_pct': b_st_pct,
            'vulnerable_pct': b_vul_pct,
            'pasture': round(bd['pasture'], 2),
            'cfrr': round(bd['cfrr'], 2),
            'common_land': round(bd['common_land'], 2),
            'com_pct': b_com_pct,
            'pasture_pct': b_pas_pct,
            'com_per_hh': b_com_per_hh,
            'vbgramg_ha': round(bd['vbgramg_ha'], 2),
            'vbgramg_villages': bd['vbgramg_villages'],
            'cvs_villages': bd['cvs_villages'],
            'demarcated_villages': bd['demarcated_villages'],
            'bylaws_villages': bd['bylaws_villages'],
            'encroach_ha': round(bd['encroach_ha'], 2),
            'pasture_recog_ha': round(bd['pasture_recog_ha'], 2),
            'plots_count': bd['plots_count'],
            'panchayats': panchayats_list
        })

    summary_data = {
        'district': {
            'id': dist_id,
            'num': cfg['num'],
            'name': cfg['name'],
            'total_blocks': len(blocks_data),
            'total_panchayats': tot_panchayats,
            'total_villages': len(villages),
            'geo_area': round(tot_geo, 2),
            'households': tot_hh,
            'population': tot_pop,
            'male': tot_m,
            'female': tot_f,
            'sex_ratio': dist_sex_ratio,
            'sc_pop': tot_sc,
            'sc_pct': round((tot_sc / max(1, tot_pop)) * 100, 2),
            'st_pop': tot_st,
            'st_pct': round((tot_st / max(1, tot_pop)) * 100, 2),
            'vulnerable_pct': round(((tot_sc + tot_st) / max(1, tot_pop)) * 100, 2),
            'pasture': round(tot_pas, 2),
            'cfrr': round(tot_cfrr, 2),
            'common_land': round(tot_com, 2),
            'common_land_pct': round((tot_com / max(1.0, tot_geo)) * 100, 2),
            'vbgramg_ha': round(tot_vbg_ha, 2),
            'vbgramg_villages': tot_vbg_vil,
            'cvs_formed': tot_cvs_vil,
            'demarcated_villages': tot_demarc_vil,
            'bylaws_villages': tot_bylaws_vil,
            'encroach_ha': round(tot_encroach, 2),
            'pasture_recog_ha': round(tot_recog, 2),
            'plots_count': len(plots)
        },
        'blocks': summary_blocks
    }

    out_dir = os.path.join(data_dir, 'districts', dist_id)
    os.makedirs(out_dir, exist_ok=True)

    with open(os.path.join(out_dir, 'summary.json'), 'w', encoding='utf-8') as f:
        json.dump(summary_data, f, indent=2)

    with open(os.path.join(out_dir, 'villages.json'), 'w', encoding='utf-8') as f:
        json.dump(villages, f)

    with open(os.path.join(out_dir, 'plots.json'), 'w', encoding='utf-8') as f:
        json.dump(plots, f, indent=2)

    # If Jodhpur, also update root data/ files
    if dist_id == 'jodhpur':
        with open(os.path.join(data_dir, 'summary.json'), 'w', encoding='utf-8') as f:
            json.dump(summary_data, f, indent=2)
        with open(os.path.join(data_dir, 'villages.json'), 'w', encoding='utf-8') as f:
            json.dump(villages, f)
        with open(os.path.join(data_dir, 'plots.json'), 'w', encoding='utf-8') as f:
            json.dump(plots, f, indent=2)

    print(f"-> Saved {cfg['name']}: {len(villages)} villages, {len(blocks_data)} blocks, {len(plots)} plots.")

def main():
    data_dir = '/var/www/dashboard/data'
    print("Starting Raw Excel Data Generation for 7 Districts...")
    districts_list = []

    for dist_id, cfg in DISTRICTS_CONFIG.items():
        process_district(dist_id, cfg, data_dir)
        districts_list.append({
            'id': dist_id,
            'num': cfg['num'],
            'name': cfg['name'],
            'center': cfg['center'],
            'zoom': cfg['zoom'],
            'dist_code': cfg['dist_code'],
            'excel_file': cfg['file']
        })

    # Save updated districts.json
    with open(os.path.join(data_dir, 'districts.json'), 'w', encoding='utf-8') as f:
        json.dump(districts_list, f, indent=2)

    print("All 7 districts generated 100% directly from Excel!")

if __name__ == '__main__':
    main()
