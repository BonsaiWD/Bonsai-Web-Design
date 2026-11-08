'use client';

import styled from 'styled-components';
import { PHONE, space, tint, type } from '@/components/portal/ui';

/*
 * A table from 768px up and stacked rows below it. Stacking sets display: block, which
 * drops the table's meaning in some browsers, so markup using this also carries explicit
 * roles (table, row, columnheader, cell). Each cell's data-label names its column on phones;
 * a cell marked data-primary is the row's title and shows no label.
 */
export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  ${type.body}
  ${type.figures}

  caption {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  th {
    ${type.overline}
    padding: ${space[3]} ${space[4]};
    text-align: left;
    white-space: nowrap;
    border-bottom: 1px solid ${({ theme }) => tint(theme.colors.primary, 12)};
  }

  td {
    padding: ${space[4]};
    vertical-align: top;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  tbody tr + tr td {
    border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};
  }

  th:first-child,
  td:first-child {
    padding-left: ${space[6]};
  }

  th:last-child,
  td:last-child {
    padding-right: ${space[6]};
  }

  @media (max-width: ${PHONE}) {
    thead {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }

    tbody,
    tr,
    td {
      display: block;
    }

    tr {
      padding: ${space[4]} ${space[5]};
    }

    tbody tr + tr {
      border-top: 1px solid ${({ theme }) => tint(theme.colors.primary, 10)};
    }

    tbody tr + tr td {
      border-top: none;
    }

    td,
    td:first-child,
    td:last-child {
      display: grid;
      grid-template-columns: 7rem minmax(0, 1fr);
      gap: ${space[3]};
      padding: ${space[1]} 0;
    }

    td::before {
      content: attr(data-label);
      ${type.meta}
    }

    td[data-primary] {
      display: block;
      padding-bottom: ${space[2]};
    }

    td[data-primary]::before {
      content: none;
    }
  }
`;
