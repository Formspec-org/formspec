/** @filedesc Response contract and pruning: getResponse() omits non-relevant fields and meets the response shape contract */
import test from 'node:test';
import assert from 'node:assert/strict';
import { FormEngine } from '../dist/index.js';

test('should prune non-relevant leaf fields when calling getResponse()', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test',
    version: '1.0.0',
    title: 'Leaf Pruning',
    items: [
      { key: 'show', type: 'field', dataType: 'boolean', label: 'Show' },
      { key: 'hiddenField', type: 'field', dataType: 'string', label: 'Hidden', initialValue: 'Secret' }
    ],
    binds: [{ path: 'hiddenField', relevant: 'show == true' }]
  });

  let response = engine.getResponse();
  assert.equal(response.data.hiddenField, undefined);

  engine.setValue('show', true);
  response = engine.getResponse();
  assert.equal(response.data.hiddenField, 'Secret');

  engine.setValue('show', false);
  response = engine.getResponse();
  assert.equal(response.data.hiddenField, undefined);
});

test('should deep-prune hidden groups from response data when parent visibility turns false', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/test-deep-prune',
    version: '1.0.0',
    title: 'Deep Pruning',
    items: [
      { type: 'field', dataType: 'boolean', key: 'showParent', label: 'Show Parent' },
      {
        type: 'group',
        key: 'parent',
        label: 'Parent',
        visible: 'showParent == true',
        children: [{ type: 'field', dataType: 'string', key: 'child', label: 'Child' }]
      }
    ]
  });

  engine.setValue('showParent', true);
  engine.setValue('parent.child', 'Hello');
  engine.setValue('showParent', false);

  const response = engine.getResponse();
  assert.equal(response.data.parent, undefined);
});

test('should emit required top-level response fields when generating responses', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'http://example.org/forms/shopping-cart',
    version: '1.0.0',
    title: 'Shopping Cart',
    items: [
      { type: 'field', dataType: 'decimal', key: 'price', label: 'Price' },
      { type: 'field', dataType: 'decimal', key: 'quantity', label: 'Quantity' }
    ]
  });

  const response = engine.getResponse();

  assert.ok(Object.hasOwn(response, 'definitionUrl'));
  assert.ok(Object.hasOwn(response, 'definitionVersion'));
  assert.ok(Object.hasOwn(response, 'status'));
  assert.ok(Object.hasOwn(response, 'data'));
  assert.ok(Object.hasOwn(response, 'authored'));
  assert.ok(Object.hasOwn(response, 'validationResults'));
  assert.equal(typeof response.definitionUrl, 'string');
  assert.equal(typeof response.authored, 'string');
  assert.notEqual(new Date(response.authored).toString(), 'Invalid Date');
});

test('should include authored signatures in the response envelope and normalize response identity', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'https://example.org/forms/signature-attestation',
    version: '1.0.0',
    title: 'Signature Attestation',
    items: [
      { type: 'field', dataType: 'string', key: 'signerName', label: 'Signer name' },
      { type: 'field', dataType: 'boolean', key: 'consentAccepted', label: 'Consent accepted' },
      { type: 'field', dataType: 'attachment', key: 'signatureCapture', label: 'Signature capture' }
    ]
  });

  engine.setValue('signerName', 'Ada Lovelace');
  engine.setValue('consentAccepted', true);
  engine.setValue('signatureCapture', 'data:image/png;base64,AAA=');

  const response = engine.getResponse({
    author: { id: 'applicant', name: 'Ada Lovelace' },
    authoredSignatures: [
      {
        documentId: 'benefitsApplication',
        signatureValue: 'data:image/png;base64,AAA=',
        signatureMethod: 'drawn',
        signedAt: '2026-04-22T12:00:00Z',
        consentAccepted: true,
        consentTextRef: 'urn:agency.gov:consent:esign-benefits:v1',
        consentVersion: '1.0.0',
        affirmationText: 'I certify under penalty of perjury that this submission is true and complete.',
        documentHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        documentHashAlgorithm: 'sha-256',
        responseId: 'resp-2026-0001',
        identityProofRef: 'urn:agency.gov:identity-proof:case-2026-0042',
        identityBinding: {
          method: 'email-otp',
          assuranceLevel: 'standard',
          providerRef: 'urn:agency.gov:identity:providers:email-otp'
        },
        signatureProvider: 'urn:agency.gov:signature:providers:formspec',
        ceremonyId: 'ceremony-2026-0001'
      }
    ]
  });

  assert.equal(response.id, 'resp-2026-0001');
  assert.ok(Array.isArray(response.authoredSignatures));
  assert.equal(response.authoredSignatures.length, 1);
  assert.equal(response.authoredSignatures[0].responseId, 'resp-2026-0001');
  assert.equal(response.authoredSignatures[0].signerId, 'applicant');
  assert.equal(response.authoredSignatures[0].signerName, 'Ada Lovelace');
});

test('should reject authored signatures that disagree on response identity', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'https://example.org/forms/signature-attestation',
    version: '1.0.0',
    title: 'Signature Attestation',
    items: [{ type: 'field', dataType: 'string', key: 'signerName', label: 'Signer name' }]
  });

  assert.throws(
    () => engine.getResponse({
      authoredSignatures: [
        {
          documentId: 'benefitsApplication',
          signatureValue: 'urn:agency.gov:signature:primary',
          signatureMethod: 'provider-managed',
          signerName: 'Ada Lovelace',
          signedAt: '2026-04-22T12:00:00Z',
          consentAccepted: true,
          consentTextRef: 'urn:agency.gov:consent:esign-benefits:v1',
          consentVersion: '1.0.0',
          affirmationText: 'I certify under penalty of perjury that this submission is true and complete.',
          documentHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          documentHashAlgorithm: 'sha-256',
          responseId: 'resp-1',
          signatureProvider: 'urn:agency.gov:signature:providers:formspec',
          ceremonyId: 'ceremony-1'
        },
        {
          documentId: 'benefitsApplication',
          signatureValue: 'urn:agency.gov:signature:secondary',
          signatureMethod: 'provider-managed',
          signerName: 'Ada Lovelace',
          signedAt: '2026-04-22T12:05:00Z',
          consentAccepted: true,
          consentTextRef: 'urn:agency.gov:consent:esign-benefits:v1',
          consentVersion: '1.0.0',
          affirmationText: 'I certify under penalty of perjury that this submission is true and complete.',
          documentHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          documentHashAlgorithm: 'sha-256',
          responseId: 'resp-2',
          signatureProvider: 'urn:agency.gov:signature:providers:formspec',
          ceremonyId: 'ceremony-2'
        }
      ]
    }),
    /single responseId/
  );
});

test('should use meta.id when authored signatures omit responseId', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'https://example.org/forms/signature-attestation',
    version: '1.0.0',
    title: 'Signature Attestation',
    items: [{ type: 'field', dataType: 'string', key: 'signerName', label: 'Signer name' }]
  });

  const baseSig = {
    documentId: 'benefitsApplication',
    signatureValue: 'urn:agency.gov:signature:primary',
    signatureMethod: 'provider-managed',
    signerName: 'Ada Lovelace',
    signedAt: '2026-04-22T12:00:00Z',
    consentAccepted: true,
    consentTextRef: 'urn:agency.gov:consent:esign-benefits:v1',
    consentVersion: '1.0.0',
    affirmationText: 'I certify under penalty of perjury that this submission is true and complete.',
    documentHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    documentHashAlgorithm: 'sha-256',
    signatureProvider: 'urn:agency.gov:signature:providers:formspec',
    ceremonyId: 'ceremony-1'
  };

  const response = engine.getResponse({
    id: 'resp-from-meta',
    author: { id: 'applicant', name: 'Ada Lovelace' },
    authoredSignatures: [
      { ...baseSig, signatureValue: 'urn:agency.gov:signature:primary' },
      { ...baseSig, signatureValue: 'urn:agency.gov:signature:secondary', signedAt: '2026-04-22T12:05:00Z', ceremonyId: 'ceremony-2' }
    ]
  });

  assert.equal(response.id, 'resp-from-meta');
  assert.equal(response.authoredSignatures[0].responseId, 'resp-from-meta');
  assert.equal(response.authoredSignatures[1].responseId, 'resp-from-meta');
});

test('should infer signerName from meta.author.name when omitted on signatures', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'https://example.org/forms/signature-attestation',
    version: '1.0.0',
    title: 'Signature Attestation',
    items: [{ type: 'field', dataType: 'string', key: 'signerName', label: 'Signer name' }]
  });

  const response = engine.getResponse({
    id: 'resp-2026-0002',
    author: { id: 'applicant', name: 'Grace Hopper' },
    authoredSignatures: [
      {
        documentId: 'benefitsApplication',
        signatureValue: 'data:image/png;base64,AAA=',
        signatureMethod: 'drawn',
        signedAt: '2026-04-22T12:00:00Z',
        consentAccepted: true,
        consentTextRef: 'urn:agency.gov:consent:esign-benefits:v1',
        consentVersion: '1.0.0',
        affirmationText: 'I certify under penalty of perjury that this submission is true and complete.',
        documentHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        documentHashAlgorithm: 'sha-256',
        responseId: 'resp-2026-0002',
        signatureProvider: 'urn:agency.gov:signature:providers:formspec',
        ceremonyId: 'ceremony-2026-0001'
      }
    ]
  });

  assert.equal(response.authoredSignatures[0].signerName, 'Grace Hopper');
});

test('should strip unknown properties from authored signature inputs', () => {
  const engine = new FormEngine({
    $formspec: '1.0',
    url: 'https://example.org/forms/signature-attestation',
    version: '1.0.0',
    title: 'Signature Attestation',
    items: [{ type: 'field', dataType: 'string', key: 'signerName', label: 'Signer name' }]
  });

  const response = engine.getResponse({
    id: 'resp-2026-0003',
    author: { id: 'applicant', name: 'Ada Lovelace' },
    authoredSignatures: [
      {
        documentId: 'benefitsApplication',
        signatureValue: 'urn:agency.gov:signature:primary',
        signatureMethod: 'provider-managed',
        signerName: 'Ada Lovelace',
        signedAt: '2026-04-22T12:00:00Z',
        consentAccepted: true,
        consentTextRef: 'urn:agency.gov:consent:esign-benefits:v1',
        consentVersion: '1.0.0',
        affirmationText: 'I certify under penalty of perjury that this submission is true and complete.',
        documentHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        documentHashAlgorithm: 'sha-256',
        responseId: 'resp-2026-0003',
        signatureProvider: 'urn:agency.gov:signature:providers:formspec',
        ceremonyId: 'ceremony-1',
        clientOpaqueAuditToken: 'should-not-appear-in-envelope'
      }
    ]
  });

  assert.ok(!Object.hasOwn(response.authoredSignatures[0], 'clientOpaqueAuditToken'));
});
