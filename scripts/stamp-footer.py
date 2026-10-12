"""Acrescenta o rodapé com número de página ao relatório, sem depender de Java.

O LibreOffice não renderiza o <style:footer> definido em ODF, por isso o rodapé é
desenhado directamente no fluxo de conteúdo de cada página: acrescenta-se uma
instrução BT/ET no fim do stream e regista-se a fonte base-14 nas propriedades
da página. É mais simples e robusto que compor um XObject.
"""

import sys

import pypdf
from pypdf.generic import (
    ArrayObject,
    DecodedStreamObject,
    DictionaryObject,
    IndirectObject,
    NameObject,
)


def _deref(obj):
    return obj.get_object() if isinstance(obj, IndirectObject) else obj


def _resolve(writer, obj):
    """Devolve uma referência indirecta para `obj`, criando-a se for preciso."""
    if isinstance(obj, IndirectObject):
        return obj
    return writer._add_object(obj)


def stamp(src, dst, title='G3 · Avaliações e Horários'):
    reader = pypdf.PdfReader(src)
    writer = pypdf.PdfWriter()
    total = len(reader.pages)

    for index, page in enumerate(reader.pages, start=1):
        width = float(page.mediabox.width)
        height = float(page.mediabox.height)

        # --- fonte base-14 nas recursos da página ---
        resources = _deref(page.get('/Resources'))
        if resources is None:
            resources = DictionaryObject()
            page[NameObject('/Resources')] = _resolve(writer, resources)

        fonts = _deref(resources.get('/Font'))
        if fonts is None:
            fonts = DictionaryObject()
            resources[NameObject('/Font')] = _resolve(writer, fonts)

        fonts[NameObject('/HelvFooter')] = _resolve(writer, DictionaryObject({
            NameObject('/Type'): NameObject('/Font'),
            NameObject('/Subtype'): NameObject('/Type1'),
            NameObject('/BaseFont'): NameObject('/Helvetica'),
            NameObject('/Encoding'): NameObject('/WinAnsiEncoding'),
        }))

        # --- rodapé desenhado no fim do fluxo de conteúdo ---
        label = f'{title}  |  página {index} de {total}'
        label = label.encode('latin-1', 'replace').decode('latin-1')
        size = 8.5
        text_w = len(label) * size * 0.5
        x = (width - text_w) / 2.0
        y = 42.0
        footer = f'\nq 0.4 0.4 0.4 rg BT /HelvFooter {size} Tf {x:.1f} {y:.1f} Td ({label}) Tj ET Q\n'

        existing = _deref(page.get('/Contents'))
        if existing is None:
            data = b''
        elif isinstance(existing, ArrayObject):
            data = b'\n'.join(_deref(part).get_data() for part in existing)
        else:
            data = existing.get_data()

        merged = DecodedStreamObject()
        merged.set_data(data + footer.encode('latin-1'))
        page[NameObject('/Contents')] = _resolve(writer, merged)

        writer.add_page(page)

    with open(dst, 'wb') as fh:
        writer.write(fh)

    print(f'{total} paginas com rodape -> {dst}')


if __name__ == '__main__':
    stamp(sys.argv[1], sys.argv[2])