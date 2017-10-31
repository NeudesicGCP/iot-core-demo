// Copyright 2017 Neudesic. All rights reserved.
// Use of this source code is governed by MIT license that can be found in the
// LICENSE file.

package main

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/asn1"
	"encoding/pem"
	"io"
	"io/ioutil"
	"math/big"
	"sync"
	"time"

	"google.golang.org/appengine/log"
)

const (
	RSA_KEY_BITS                  = 2048
	CA_FILE_ENV_NAME              = "REGISTRATION_SERVICE_CA_FILE"
	CA_FILE_DEFAULT_VALUE         = "ca.pem"
	CA_KEY_FILE_ENV_NAME          = "REGISTRATION_SERVICE_CA_KEY_FILE"
	CA_KEY_FILE_DEFAULT_VALUE     = "ca-key.pem"
	CERT_EXPIRATION_ENV_NAME      = "REGISTRATION_SERVICE_CERT_EXPIRATION"
	CERT_EXPIRATION_DEFAULT_VALUE = "1440h"
	CERT_COUNTRY_ENV_NAME         = "REGISTRATION_SERVICE_CERT_COUNTRY"
	CERT_COUNTRY_DEFAULT_VALUE    = "US"
	CERT_PROVINCE_ENV_NAME        = "REGISTRATION_SERVICE_CERT_PROVINCE"
	CERT_PROVINCE_DEFAULT_VALUE   = "California"
	CERT_LOCALITY_ENV_NAME        = "REGISTRATION_SERVICE_CERT_LOCALITY"
	CERT_LOCALITY_DEFAULT_VALUE   = "Irvine"
	CERT_ORG_ENV_NAME             = "REGISTRATION_SERVICE_CERT_ORG"
	CERT_ORG_DEFAULT_VALUE        = "Neudesic"
	CERT_ORG_UNIT_ENV_NAME        = "REGISTRATION_SERVICE_CERT_ORG_UNIT"
	CERT_ORG_UNIT_DEFAULT_VALUE   = "GCP"
)

var (
	ca       *x509.Certificate
	caKey    crypto.Signer
	caLoaded = false
	mu       = &sync.Mutex{}
	// When creating a certificate it will expire after this duration.
	certExpiration time.Duration
	// The certs issued will have singular Country, Locality, etc, but
	// x509 objects expect slice of values.
	certCountries  []string
	certProvinces  []string
	certLocalities []string
	certOrgs       []string
	certOrgUnits   []string
)

func init() {
	exp, err := time.ParseDuration(getEnvOrDefault(CERT_EXPIRATION_ENV_NAME, CERT_EXPIRATION_DEFAULT_VALUE))
	if err != nil {
		exp, err = time.ParseDuration(CERT_EXPIRATION_DEFAULT_VALUE)
	}
	certExpiration = exp
	certCountries = []string{getEnvOrDefault(CERT_COUNTRY_ENV_NAME, CERT_COUNTRY_DEFAULT_VALUE)}
	certProvinces = []string{getEnvOrDefault(CERT_PROVINCE_ENV_NAME, CERT_PROVINCE_DEFAULT_VALUE)}
	certLocalities = []string{getEnvOrDefault(CERT_LOCALITY_ENV_NAME, CERT_LOCALITY_DEFAULT_VALUE)}
	certOrgs = []string{getEnvOrDefault(CERT_ORG_ENV_NAME, CERT_ORG_DEFAULT_VALUE)}
	certOrgUnits = []string{getEnvOrDefault(CERT_ORG_UNIT_ENV_NAME, CERT_ORG_UNIT_DEFAULT_VALUE)}
}

// Lazy load of CA certificate and key from file system.
func loadCA(ctx context.Context) error {
	mu.Lock()
	defer mu.Unlock()
	if caLoaded {
		return nil
	}
	fileName := getEnvOrDefault(CA_FILE_ENV_NAME, CA_FILE_DEFAULT_VALUE)
	raw, err := ioutil.ReadFile(fileName)
	if err != nil {
		log.Criticalf(ctx, "Error reading CA file: %v", err)
		return err
	}
	raw = bytes.TrimSpace(raw)
	block, _ := pem.Decode(raw)
	if block == nil {
		log.Criticalf(ctx, "Error decoding CA file")
		return err
	}
	ca, err = x509.ParseCertificate(block.Bytes)
	if err != nil {
		log.Criticalf(ctx, "Error parsing certificate: %v", err)
		return err
	}

	fileName = getEnvOrDefault(CA_KEY_FILE_ENV_NAME, CA_KEY_FILE_DEFAULT_VALUE)
	raw, err = ioutil.ReadFile(fileName)
	if err != nil {
		log.Criticalf(ctx, "Error reading CA file: %v", err)
		return err
	}
	raw = bytes.TrimSpace(raw)
	block, _ = pem.Decode(raw)
	if block == nil {
		log.Criticalf(ctx, "Error decoding CA key file")
		return err
	}
	caKey, err = x509.ParsePKCS1PrivateKey(block.Bytes)
	if err != nil {
		log.Criticalf(ctx, "Error parsing RSA key: %v", err)
		return err
	}
	caLoaded = true
	return nil
}

// Creates a new certificate and key pair, signed by CA, as byte slices.
func makeCert(ctx context.Context, name string) (cert []byte, key []byte, err error) {
	if !caLoaded {
		err = loadCA(ctx)
		if err != nil {
			return
		}
	}

	// Create a new RSA key
	var privKey *rsa.PrivateKey
	privKey, err = rsa.GenerateKey(rand.Reader, RSA_KEY_BITS)
	if err != nil {
		log.Errorf(ctx, "Unable to generate RSA private key: %v", err)
		return
	}
	key = x509.MarshalPKCS1PrivateKey(privKey)
	key = pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: key,
	})

	// Generate a CSR
	csrReq := x509.CertificateRequest{
		Subject: pkix.Name{
			CommonName:         name,
			Country:            certCountries,
			Province:           certProvinces,
			Locality:           certLocalities,
			Organization:       certOrgs,
			OrganizationalUnit: certOrgUnits,
		},
		SignatureAlgorithm: x509.SHA256WithRSA,
	}
	var csr []byte
	csr, err = x509.CreateCertificateRequest(rand.Reader, &csrReq, privKey)
	if err != nil {
		log.Errorf(ctx, "Unable to generate a CSR: %v", err)
		return
	}

	// Validate the CSR
	parsed, err := x509.ParseCertificateRequest(csr)
	if err != nil {
		log.Errorf(ctx, "Parsing CSR failed: %v", err)
		return
	}
	err = parsed.CheckSignature()
	if err != nil {
		log.Errorf(ctx, "CSR signature check failed: %v", err)
		return
	}

	// Create a template from parse CSR
	tmp := x509.Certificate{
		Subject:            parsed.Subject,
		PublicKeyAlgorithm: parsed.PublicKeyAlgorithm,
		PublicKey:          parsed.PublicKey,
		SignatureAlgorithm: x509.SHA256WithRSA,
	}

	// Create a random serial number
	serial := make([]byte, 20)
	_, err = io.ReadFull(rand.Reader, serial)
	if err != nil {
		log.Errorf(ctx, "Unable to create random serial number: %v", err)
		return
	}
	serial[0] &= 0x7f
	tmp.SerialNumber = new(big.Int).SetBytes(serial)

	// Prepare the template
	var ski []byte
	ski, err = ComputeSKI(&tmp)
	if err != nil {
		log.Errorf(ctx, "Error generating subject key id: %v", err)
		return
	}
	tmp.SubjectKeyId = ski
	tmp.NotBefore = time.Now().Add(-1 * time.Minute).UTC()
	tmp.NotAfter = tmp.NotBefore.Add(certExpiration).UTC()
	tmp.KeyUsage = x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment
	tmp.ExtKeyUsage = []x509.ExtKeyUsage{
		x509.ExtKeyUsageClientAuth,
	}
	tmp.BasicConstraintsValid = true

	// Sign the certificate with CA
	cert, err = x509.CreateCertificate(rand.Reader, &tmp, ca, tmp.PublicKey, caKey)
	if err != nil {
		log.Errorf(ctx, "Error creating certificate: %v", err)
		return
	}
	cert = pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: cert,
	})

	return
}

// Code from this point shamelessly taken from CFSSL source code.
// Released by Cloudflare under BSD-2 like licence.
// https://github.com/cloudflare/cfssl/blob/master/signer/signer.go#L214
type subjectPublicKeyInfo struct {
	Algorithm        pkix.AlgorithmIdentifier
	SubjectPublicKey asn1.BitString
}

// ComputeSKI derives an SKI from the certificate's public key in a
// standard manner. This is done by computing the SHA-1 digest of the
// SubjectPublicKeyInfo component of the certificate.
func ComputeSKI(template *x509.Certificate) ([]byte, error) {
	pub := template.PublicKey
	encodedPub, err := x509.MarshalPKIXPublicKey(pub)
	if err != nil {
		return nil, err
	}

	var subPKI subjectPublicKeyInfo
	_, err = asn1.Unmarshal(encodedPub, &subPKI)
	if err != nil {
		return nil, err
	}

	pubHash := sha1.Sum(subPKI.SubjectPublicKey.Bytes)
	return pubHash[:], nil
}
