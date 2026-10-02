import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TranslateService } from '@app-galaxy/translate-ui';
import { AdminExportService, TableExportDto } from '@ui-slim/apiClient';
import { saveBlob } from '../download';
import { exportFileName, ExportFormat, TableExportData } from './table-export';

const LANGS: readonly NonNullable<TableExportDto['lang']>[] = ['de', 'fr', 'it', 'en'];

/**
 * Sends a table to `admin/export/table` and hands the file to the browser
 * (B1 5.5.5, slm 3). The labels of the block in the sheet follow the
 * language of the user.
 */
@Injectable({ providedIn: 'root' })
export class TableExportFacade {
  private readonly api = inject(AdminExportService);
  private readonly translate = inject(TranslateService);

  /** False when the API did not answer with a file. */
  async download(data: TableExportData, format: ExportFormat): Promise<boolean> {
    const lang = LANGS.find((l) => l === this.translate.lang) ?? 'de';
    try {
      const blob = await firstValueFrom(this.api.adminExportTable({ body: { ...data, format, lang } }));
      saveBlob(blob, exportFileName(data.table, format));
      return true;
    } catch {
      return false;
    }
  }
}
